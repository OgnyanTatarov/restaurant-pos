// Both Windows hubs share one ordered event log. Each machine applies every
// event; only the originating machine prints tickets for that command.
import { createHash, randomUUID } from "node:crypto";
import { websiteMenuRows, menuFromWebsiteRows } from "../core/website-menu.mjs";

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

function cloudSnapshot(snapshot) {
  return {
    ...snapshot,
    orders: (snapshot.orders || []).filter((order) => order.status === "open"),
    jobs: [],
    audit: [],
  };
}

function menuSignature(snapshot) {
  const menu = snapshot?.menu || snapshot || [];
  const categories = snapshot?.categories || [];
  const sides = new Map(
    categories.map((category) => [
      category.name,
      (category.sides || [])
        .filter((side) => !side.deleted)
        .map((side) => `${side.name}:${side.price || 0}`)
        .join(","),
    ]),
  );
  return (Array.isArray(menu) ? menu : [])
    .filter((item) => item && !item.deleted)
    .map((item) =>
      [
        item.id,
        item.name,
        item.price,
        item.category,
        item.station,
        item.available,
        item.sideMode || "",
        sides.get(item.category) || "",
        (item.cookOptions || []).map((cook) => cook.name).join(","),
        (item.modifiers || []).map((mod) => mod.name).join(","),
        (item.addonGroups || [])
          .map(
            (group) =>
              `${group.name}:${(group.extras || []).map((extra) => `${extra.name}:${extra.price || 0}`).join(",")}`,
          )
          .join(";"),
      ].join("\u001f"),
    )
    .join("\n");
}

async function publishWebsiteMenu(request, state, restaurantId, updatedAt) {
  const rows = websiteMenuRows(state, restaurantId, updatedAt);
  for (let index = 0; index < rows.length; index += 25) {
    await request("pos_menu_items?on_conflict=restaurant_id,id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(index, index + 25)),
    });
  }
  const ids = rows.map((row) => row.id).join(",");
  const filter = ids
    ? `restaurant_id=eq.${encodeURIComponent(restaurantId)}&id=not.in.(${ids})`
    : `restaurant_id=eq.${encodeURIComponent(restaurantId)}`;
  await request(`pos_menu_items?${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
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
    syncing = false,
    ingesting = false,
    bootstrapTask = null;
  // Local engine applies stay ordered. Network waits stay off this chain so a
  // phone round-trip cannot pause the till-to-till pull.
  let applyChain = Promise.resolve();
  const withEngine = (fn) => {
    const run = applyChain.then(() => fn());
    applyChain = run.then(
      () => {},
      () => {},
    );
    return run;
  };
  let publishChain = Promise.resolve();
  const failures = new Map();
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
  const insertEvent = async (command, actor) => {
    let next = command;
    if (
      (command.type === "demo.load" || command.type === "menu.replace") &&
      !engine.resultOf(command.id)
    ) {
      next = await withEngine(() => {
        if (engine.resultOf(command.id)) return command;
        engine.execute(command, actor);
        return {
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
      });
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
      const progressed = await withEngine(() => {
        let applied = 0;
        for (const event of events) {
          if (Number(event.seq) <= engine.eventSeq()) continue;
          const command = event.command || {};
          try {
            engine.execute(command, event.actor, {
              print: event.hub_id === engine.state.hubId,
            });
            failures.delete(command.id);
          } catch (e) {
            failures.set(command.id, e);
            if (waitingId && command.id === waitingId) ownError = e;
          }
          engine.setEventSeq(event.seq);
          applied++;
        }
        return applied;
      });
      if (!progressed) break;
    }
    if (!ownError && waitingId && failures.has(waitingId))
      ownError = failures.get(waitingId);
    if (ownError) throw ownError;
  };
  const pullWebsiteMenu = async () => {
    const rows = await request(
      `pos_menu_items?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&select=id,name,category,category_sort,price,station,available,image,modifiers,addon_groups,cook_options,side_mode,sort_order&order=category_sort.asc,sort_order.asc`,
    );
    if (!rows?.length) return;
    const next = menuFromWebsiteRows(rows);
    if (
      menuSignature(next) ===
      menuSignature({
        menu: engine.state.menu,
        categories: engine.state.categories,
      })
    )
      return;
    await withEngine(() => {
      engine.execute(
        { id: randomUUID(), type: "menu.sync", payload: next },
        desktopActor(),
        { print: false },
      );
    });
  };
  const acceptWebOrders = async () => {
    const rows = await request(
      `pos_web_orders?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&status=eq.new&select=id,customer_name,phone,note,fulfilment,address,items&order=created_at.asc&limit=20`,
    );
    for (const row of rows || []) {
      const claimed = await request(
        `pos_web_orders?id=eq.${encodeURIComponent(row.id)}&status=eq.new`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ status: "accepted" }),
        },
      );
      if (!Array.isArray(claimed) || !claimed.length) continue;
      const command = {
        id: row.id,
        type: "order.web",
        payload: {
          orderId: row.id,
          customerName: row.customer_name,
          phone: row.phone || "",
          note: row.note || "",
          fulfilment: row.fulfilment,
          address: row.address || "",
          items: Array.isArray(row.items) ? row.items : [],
        },
      };
      try {
        await insertEvent(command, {
          id: engine.state.hubId,
          name: "Website",
          role: "manager",
        });
        await pullApply(row.id);
      } catch (e) {
        await request(`pos_web_orders?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: "rejected",
            error: String(e.message || "Could not open the order").slice(0, 300),
          }),
        }).catch(() => {});
      }
    }
  };
  const publishSnapshot = () => {
    const run = publishChain.then(async () => {
      if (stopped) return;
      await pullWebsiteMenu();
      if (stopped || engine.state.revision === lastRevision) return;
      const snapshot = cloudSnapshot(engine.snapshot());
      const revision = snapshot.revision;
      const updatedAt = new Date().toISOString();
      await request("pos_snapshots?on_conflict=restaurant_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          restaurant_id: config.restaurantId,
          revision,
          event_seq: engine.eventSeq(),
          state: snapshot,
          updated_at: updatedAt,
        }),
      });
      await publishWebsiteMenu(request, snapshot, config.restaurantId, updatedAt);
      if (revision > lastRevision) lastRevision = revision;
    });
    publishChain = run.then(
      () => {},
      () => {},
    );
    return run;
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
  const ensureBootstrap = () => {
    if (bootstrapped) return Promise.resolve();
    if (!bootstrapTask) {
      bootstrapTask = (async () => {
        const rows = await request(
          `pos_snapshots?restaurant_id=eq.${encodeURIComponent(config.restaurantId)}&select=state,event_seq,revision`,
        );
        await withEngine(() => {
          if (bootstrapped) return;
          const snap = rows?.[0];
          const empty =
            !engine.state.tables.length &&
            !engine.state.menu.length &&
            !engine.state.orders.length &&
            !engine.state.categories.length;
          if (
            empty &&
            snap?.state &&
            (snap.state.menu?.length ||
              snap.state.tables?.length ||
              snap.state.orders?.length)
          ) {
            engine.adoptSnapshot(snap.state);
            engine.setEventSeq(Number(snap.event_seq) || 0);
            lastRevision = engine.state.revision;
          }
          bootstrapped = true;
        });
      })().finally(() => {
        if (!bootstrapped) bootstrapTask = null;
      });
    }
    return bootstrapTask;
  };
  // Phone commands are applied beside the sync loop. Their network waits must
  // not delay the next pull of the other till's events.
  const ingestOnce = () => {
    if (ingesting || stopped) return;
    ingesting = true;
    ensureBootstrap()
      .then(() => ingestMobile())
      .then(() => publishSnapshot())
      .catch((e) => {
        lastError = e.message;
      })
      .finally(() => {
        ingesting = false;
      });
  };
  async function tick() {
    if (stopped || syncing) return;
    syncing = true;
    try {
      await request("rpc/pos_claim_hub", {
        method: "POST",
        body: JSON.stringify({
          p_restaurant: config.restaurantId,
          p_hub: engine.state.hubId,
        }),
      });
      await ensureBootstrap();
      await pullApply();
      await acceptWebOrders();
      ingestOnce();
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
      syncing = false;
      if (!stopped) timer = setTimeout(tick, 2000);
    }
  }
  void tick();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    submit(command, actor) {
      const enriched = enrichCommand(command);
      const who = desktopActor(actor);
      return (async () => {
        if (stopped) throw Error("Cloud sync is stopping");
        await ensureBootstrap();
        await insertEvent(enriched, who);
        await pullApply(enriched.id);
        const failed = failures.get(enriched.id);
        failures.delete(enriched.id);
        if (failed) throw failed;
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
      })();
    },
  };
}
