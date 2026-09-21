import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Engine } from "../core/engine.mjs";
import { startCloud } from "../desktop/cloud.mjs";
test("cloud bridge claims hub, checks membership, processes once and publishes result", async () => {
  const engine = new Engine();
  engine.execute({ id: randomUUID(), type: "demo.load" });
  const id = randomUUID(),
    restaurantId = randomUUID(),
    calls = [];
  const events = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const method = options.method || "GET";
    let body = null;
    if (url.includes("rpc/pos_claim_hub")) body = null;
    else if (url.includes("pos_snapshots") && method === "GET") body = [];
    else if (url.includes("pos_events") && method === "GET") {
      const after = Number((url.match(/seq=gt\.(\d+)/) || [])[1] || 0);
      body = events.filter((e) => e.seq > after);
    }
    else if (url.includes("pos_events") && method === "POST") {
      const row = JSON.parse(options.body);
      if (!events.some((e) => e.id === row.id))
        events.push({ ...row, seq: events.length + 1 });
      body = null;
    } else if (
      url.includes("pos_commands?") &&
      method === "GET"
    )
      body = [
        {
          id,
          user_id: "staff",
          command: {
            type: "order.open",
            payload: { tableId: engine.state.tables[0].id },
          },
        },
      ];
    else if (url.includes("pos_members?"))
      body = [{ role: "waiter", display_name: "Waiter" }];
    else if (url.includes("pos_hubs"))
      body = [{ hub_id: engine.state.hubId }];
    return new Response(body == null ? null : JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  let cloud;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("Bridge timeout")), 3000);
      cloud = startCloud(
        engine,
        {
          url: "https://example.invalid",
          serviceRoleKey: "test-key",
          restaurantId,
        },
        (status) => {
          if (status.connected) {
            clearTimeout(timeout);
            resolve();
          } else {
            clearTimeout(timeout);
            reject(Error(status.message));
          }
        },
      );
    });
    assert.equal(engine.state.orders.length, 1);
    assert.ok(calls[0].url.includes("pos_claim_hub"));
    assert.ok(
      calls.some(
        (c) => c.url.includes("pos_snapshots") && c.options.method === "POST",
      ),
    );
    const ack = calls.find(
      (c) => c.url.includes("pos_commands") && c.options.method === "PATCH",
    );
    assert.equal(JSON.parse(ack.options.body).status, "done");
  } finally {
    cloud?.stop();
    globalThis.fetch = original;
    engine.close();
  }
});
test("two hubs apply the same event log and only the origin queues tickets", async () => {
  const a = new Engine(),
    b = new Engine();
  a.execute({ id: randomUUID(), type: "demo.load" });
  b.adoptSnapshot(a.snapshot());
  const restaurantId = randomUUID();
  const events = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    let body = null;
    if (url.includes("pos_events") && method === "GET") {
      const after = Number((url.match(/seq=gt\.(\d+)/) || [])[1] || 0);
      body = events.filter((e) => e.seq > after);
    } else if (url.includes("pos_events") && method === "POST") {
      const row = JSON.parse(options.body);
      if (!events.some((e) => e.id === row.id))
        events.push({ ...row, seq: events.length + 1 });
      body = null;
    } else if (url.includes("pos_snapshots") && method === "GET") body = [];
    else if (url.includes("pos_commands")) body = [];
    else if (url.includes("pos_hubs"))
      body = [{ hub_id: a.state.hubId }, { hub_id: b.state.hubId }];
    return new Response(body == null ? null : JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  let cloudA, cloudB;
  const item = a.state.menu.find((m) => {
    if (m.station !== "kitchen" || m.deleted) return false;
    if ((m.cookOptions || []).some((c) => !c.deleted)) return false;
    const category = a.state.categories.find((c) => c.name === m.category);
    const mode = ["none", "free", "paid", "mixed"].includes(m.sideMode)
      ? m.sideMode
      : category?.sideMode;
    return !mode || mode === "none";
  });
  try {
    cloudA = startCloud(
      a,
      {
        url: "https://example.invalid",
        serviceRoleKey: "test-key",
        restaurantId,
      },
      () => {},
    );
    cloudB = startCloud(
      b,
      {
        url: "https://example.invalid",
        serviceRoleKey: "test-key",
        restaurantId,
      },
      () => {},
    );
    const opened = await cloudA.submit(
      {
        id: randomUUID(),
        type: "order.open",
        payload: { tableId: a.state.tables[0].id },
      },
      { id: a.state.hubId, name: "A", role: "manager" },
    );
    await cloudB.submit(
      {
        id: randomUUID(),
        type: "order.add",
        payload: {
          orderId: opened.orderId,
          version: 0,
          menuId: item.id,
          qty: 1,
        },
      },
      { id: b.state.hubId, name: "B", role: "manager" },
    );
    await cloudA.submit(
      {
        id: randomUUID(),
        type: "order.send",
        payload: { orderId: opened.orderId, version: 1 },
      },
      { id: a.state.hubId, name: "A", role: "manager" },
    );
    await cloudB.submit(
      {
        id: randomUUID(),
        type: "order.printBill",
        payload: { orderId: opened.orderId, version: 2 },
      },
      { id: b.state.hubId, name: "B", role: "manager" },
    );
    assert.equal(a.state.orders[0].id, b.state.orders[0].id);
    assert.equal(a.state.orders[0].items.length, b.state.orders[0].items.length);
    assert.equal(
      a.state.jobs.filter((j) => j.kind === "NEW" && j.status === "queued")
        .length,
      1,
    );
    assert.equal(
      b.state.jobs.filter((j) => j.kind === "NEW" && j.status === "queued")
        .length,
      0,
    );
    assert.equal(
      b.state.jobs.filter((j) => j.station === "bill" && j.status === "queued")
        .length,
      1,
    );
    assert.equal(
      a.state.jobs.filter((j) => j.station === "bill" && j.status === "queued")
        .length,
      0,
    );
  } finally {
    cloudA?.stop();
    cloudB?.stop();
    globalThis.fetch = original;
    a.close();
    b.close();
  }
});
