// Both Windows hubs share one ordered event log. Each machine applies every
// event; only the originating machine prints tickets for that command.
import { createHash, randomUUID } from "node:crypto";

const sha = (v) => createHash("sha256").update(v).digest("hex");

export function enrichCommand(command) {
  if (!command || typeof command !== "object") return command;
  const payload = { ...(command.payload || {}) };
  switch (command.type) {
    case "order.open":
      payload.orderId ||= randomUUID();
      break;
    case "order.add":
      payload.itemId ||= randomUUID();
      break;
    case "order.split":
      payload.newOrderId ||= randomUUID();
      break;
    case "order.payShare":
    case "order.close":
      payload.paymentId ||= randomUUID();
      break;
    case "order.printBill":
    case "job.retry":
      payload.jobId ||= randomUUID();
      break;
    case "table.save":
    case "category.save":
    case "menu.save":
      payload.id ||= randomUUID();
      break;
    case "settings.save":
      if (payload.pin || payload.settings?.pin) {
        const pin = String(payload.pin || payload.settings?.pin || "");
        if (/^\d{4,12}$/.test(pin)) payload.pinHash = sha(pin);
        delete payload.pin;
        if (payload.settings)
          payload.settings = { ...payload.settings, pin: undefined };
      }
      break;
  }
  payload.at ||= new Date().toISOString();
  return { ...command, payload };
}

export function startCloud(engine, config, onStatus = () => {}) {
  const desktopActor = (actor) =>
    actor || {
      id: engine.state.hubId,
      name: "Desktop manager",
      role: "manager",
    };
  if (!config?.url || !config?.serviceRoleKey || !config?.restaurantId) {
    onStatus({ connected: false, message: "Supabase not configured" });
    return {
      stop() {},
      submit(command, actor) {
        return engine.execute(enrichCommand(command), desktopActor(actor));
      },
    };
  }
  let stopped = false,
    timer,
    lastRevision = -1,
    bootstrapped = false,
    lastError = "",
    gate = Promise.resolve();
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
  const locked = (fn) => {
    const run = gate.then(fn, fn);
    gate = run.catch(() => {});
    return run;
  };
  const insertEvent = async (command, actor) => {
    let next = command;
    if (
      (command.type === "demo.load" || command.type === "menu.replace") &&
      !engine.resultOf(command.id)
    ) {
      engine.execute(command, actor);
      next = {
        ...command,
        payload: {
          ...command.payload,
          tables: engine.state.tables,
          categories: engine.state.categories,
          menu: engine.state.menu,
          settings: {
            name: engine.state.settings.name,
            currency: engine.state.settings.currency,
          },
        },
      };
    }
    await request("pos_events?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        id: next.id,
        restaurant_id: config.restaurantId,
        hub_id: engine.state.hubId,
        actor,
        command: next,
      }),
    });
  };
  const pullApply = async (waitingId) => {
    let ownError;
    for (;;) {
      const after = engine.eventSeq();
      const events = await request(
        `pos_events?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&seq=gt.${after}&order=seq.asc&limit=100`,
      );
      if (!events?.length) break;
      for (const event of events) {
        const command = event.command || {};
        try {
          engine.execute(command, event.actor, {
            print: event.hub_id === engine.state.hubId,
          });
        } catch (e) {
          if (waitingId && command.id === waitingId) ownError = e;
        }
        engine.setEventSeq(event.seq);
      }
      if (engine.eventSeq() <= after) break;
    }
    if (ownError) throw ownError;
  };
  const publishSnapshot = async () => {
    if (engine.state.revision === lastRevision) return;
    const snapshot = engine.snapshot();
    await request("pos_snapshots?on_conflict=restaurant_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        restaurant_id: config.restaurantId,
        revision: snapshot.revision,
        event_seq: engine.eventSeq(),
        state: snapshot,
        updated_at: new Date().toISOString(),
      }),
    });
    lastRevision = snapshot.revision;
  };
  const ingestMobile = async () => {
    const commands = await request(
      `pos_commands?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&status=eq.pending&order=created_at.asc&limit=100`,
    );
    for (const row of commands || []) {
      const members = await request(
        `pos_members?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&user_id=eq.${encodeURIComponent(row.user_id)}&select=role,display_name`,
      );
      if (!members?.length) {
        await request(`pos_commands?id=eq.${row.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: "error",
            result: { error: "Access revoked" },
          }),
        });
        continue;
      }
      const command = enrichCommand({
        id: row.id,
        type: row.command.type,
        payload: row.command.payload,
      });
      await request("pos_events?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          id: row.id,
          restaurant_id: config.restaurantId,
          hub_id: engine.state.hubId,
          actor: {
            id: row.user_id,
            name: members[0].display_name,
            role: members[0].role,
          },
          command,
        }),
      });
    }
    await pullApply();
    for (const row of commands || []) {
      const result = engine.resultOf(row.id);
      await request(`pos_commands?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          result
            ? { status: "done", result }
            : { status: "error", result: { error: "Command could not be applied" } },
        ),
      });
    }
  };
  const bootstrap = async () => {
    if (bootstrapped) return;
    const rows = await request(
      `pos_snapshots?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&select=state,event_seq,revision`,
    );
    const snap = rows?.[0];
    const empty =
      !engine.state.tables.length &&
      !engine.state.menu.length &&
      !engine.state.orders.length &&
      !engine.state.categories.length;
    if (empty && snap?.state && (snap.state.menu?.length || snap.state.tables?.length || snap.state.orders?.length)) {
      engine.adoptSnapshot(snap.state);
      engine.setEventSeq(Number(snap.event_seq) || 0);
      lastRevision = engine.state.revision;
    }
    bootstrapped = true;
  };
  async function tick() {
    try {
      await request("rpc/pos_claim_hub", {
        method: "POST",
        body: JSON.stringify({
          p_restaurant: config.restaurantId,
          p_hub: engine.state.hubId,
        }),
      });
      await bootstrap();
      await pullApply();
      await ingestMobile();
      await publishSnapshot();
      lastError = "";
      const hubs = await request(
        `pos_hubs?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&select=hub_id`,
      );
      const n = hubs?.length || 1;
      onStatus({
        connected: true,
        message:
          n > 1
            ? `Cloud connected · ${n} computers sharing this restaurant`
            : "Cloud connected",
        lastSync: new Date().toISOString(),
        hubs: n,
      });
    } catch (e) {
      lastError = e.message;
      onStatus({ connected: false, message: e.message });
    } finally {
      if (!stopped) timer = setTimeout(() => locked(tick), 2000);
    }
  }
  locked(tick);
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    submit(command, actor) {
      const enriched = enrichCommand(command);
      const who = desktopActor(actor);
      return locked(async () => {
        if (stopped) throw Error("Cloud sync is stopping");
        try {
          await insertEvent(enriched, who);
          await pullApply(enriched.id);
          const result = engine.resultOf(enriched.id);
          if (!result)
            throw Error(
              lastError ||
                "This order changed on another computer. Refresh and try again.",
            );
          await publishSnapshot();
          onStatus({
            connected: true,
            message: "Cloud connected",
            lastSync: new Date().toISOString(),
          });
          return result;
        } catch (e) {
          onStatus({ connected: false, message: e.message });
          throw e;
        }
      });
    },
  };
}
