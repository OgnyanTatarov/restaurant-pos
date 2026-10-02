import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Engine } from "../core/engine.mjs";
import { websiteMenuRows, menuFromWebsiteRows } from "../core/website-menu.mjs";
import { buildFlyerMenu } from "../core/flyer-menu.mjs";

test("website menu rows follow availability and omit deleted dishes", () => {
  const engine = new Engine();
  engine.execute({ id: randomUUID(), type: "demo.load" });
  const hidden = engine.state.menu.find((item) => !item.deleted);
  const removed = engine.state.menu.find(
    (item) => !item.deleted && item.id !== hidden.id,
  );
  hidden.available = false;
  removed.deleted = true;
  const rows = websiteMenuRows(engine.state, "restaurant-1", "2026-10-02T00:00:00.000Z");
  const hiddenRow = rows.find((row) => row.id === hidden.id);
  assert.equal(hiddenRow.available, false);
  assert.equal(hiddenRow.restaurant_id, "restaurant-1");
  assert.equal(hiddenRow.currency, engine.state.settings.currency);
  assert.equal(rows.some((row) => row.id === removed.id), false);
  assert.ok(rows.every((row) => row.updated_at === "2026-10-02T00:00:00.000Z"));
  const steak = rows.find((row) => row.cook_options.length);
  assert.ok(steak);
  assert.equal(steak.station, "kitchen");
  engine.close();
});

test("the flyer menu round-trips through the website rows", () => {
  const flyer = buildFlyerMenu();
  const rows = websiteMenuRows(
    { ...flyer, settings: { currency: "GBP" } },
    "restaurant-1",
  );
  const restored = menuFromWebsiteRows(rows);
  const tomahawk = restored.menu.find((item) => item.name === "45 oz Tomahawk");
  assert.equal(tomahawk.price, 9000);
  assert.equal(tomahawk.cookOptions.length, 6);
  assert.equal(
    restored.menu.find((item) => item.name === "Smirnoff 25ml").station,
    "bar",
  );
  assert.equal(restored.menu.length, flyer.menu.length);
  assert.ok(restored.menu.length > 100);
});
