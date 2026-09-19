import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Engine } from "../core/engine.mjs";
import { startCloud } from "../desktop/cloud.mjs";
test("cloud bridge claims hub, checks membership, processes once and publishes result", async () => {
  const engine = new Engine();
  engine.execute({ id: randomUUID(), type: "demo.load" });
  const id = randomUUID(),
    calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    let body = null;
    if (
      url.includes("pos_commands?") &&
      (!options.method || options.method === "GET")
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
    if (url.includes("pos_members?"))
      body = [{ role: "waiter", display_name: "Waiter" }];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  let stop;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("Bridge timeout")), 3000);
      stop = startCloud(
        engine,
        {
          url: "https://example.invalid",
          serviceRoleKey: "test-key",
          restaurantId: randomUUID(),
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
    const ack = calls.find((c) => c.options.method === "PATCH");
    assert.equal(JSON.parse(ack.options.body).status, "done");
  } finally {
    stop?.();
    globalThis.fetch = original;
    engine.close();
  }
});
