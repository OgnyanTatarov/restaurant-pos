// Desktop is the only writer of restaurant state. Cloud phones submit commands;
// this bridge applies them through the same local transaction engine.
export function startCloud(engine, config, onStatus = () => {}) {
  if (!config?.url || !config?.serviceRoleKey || !config?.restaurantId) {
    onStatus({ connected: false, message: "Supabase not configured" });
    return () => {};
  }
  let stopped = false,
    timer,
    lastRevision = -1,
    claimed = false;
  const request = async (path, options = {}) => {
    const r = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!r.ok) throw Error(`Supabase ${r.status}: ${await r.text()}`);
    return r.status === 204 ? null : await r.json().catch(() => null);
  };
  async function tick() {
    try {
      if (!claimed) {
        await request("rpc/pos_claim_hub", {
          method: "POST",
          body: JSON.stringify({
            p_restaurant: config.restaurantId,
            p_hub: engine.state.hubId,
          }),
        });
        claimed = true;
      }

      const commands = await request(
        `pos_commands?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&status=eq.pending&order=created_at.asc&limit=100`,
      );
      for (const row of commands) {
        let result,
          status = "done";
        try {
          const members = await request(
            `pos_members?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&user_id=eq.${encodeURIComponent(row.user_id)}&select=role,display_name`,
          );
          if (!members.length) throw Error("Access revoked");
          result = engine.execute(
            {
              id: row.id,
              type: row.command.type,
              payload: row.command.payload,
            },
            {
              id: row.user_id,
              name: members[0].display_name,
              role: members[0].role,
            },
          );
        } catch (e) {
          status = "error";
          result = { error: e.message };
        }
        await request(`pos_commands?id=eq.${row.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status, result }),
        });
      }
      if (engine.state.revision !== lastRevision) {
        const snapshot = engine.snapshot();
        await request("pos_snapshots?on_conflict=restaurant_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({
            restaurant_id: config.restaurantId,
            revision: snapshot.revision,
            state: snapshot,
            updated_at: new Date().toISOString(),
          }),
        });
        lastRevision = snapshot.revision;
      }
      onStatus({
        connected: true,
        message: "Cloud connected",
        lastSync: new Date().toISOString(),
      });
    } catch (e) {
      onStatus({ connected: false, message: e.message });
    } finally {
      if (!stopped) timer = setTimeout(tick, 2000);
    }
  }
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
