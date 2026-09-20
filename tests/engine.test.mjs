import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine, total, unpaidTotal, unitAmount } from "../core/engine.mjs";
import { ticketHtml, billHtml, ticketSizes } from "../desktop/ticket.mjs";
import { normalizePrinters, deviceForJob } from "../desktop/printers.mjs";
import { createHub } from "../desktop/hub.mjs";
import { parseUpdateFeed } from "../desktop/updater.cjs";
import { assertManagerPin, pinHash } from "../desktop/kiosk.cjs";
import { writeFileSync } from "node:fs";
const command = (type, payload = {}) => ({ id: randomUUID(), type, payload });
function setup() {
  const e = new Engine();
  e.execute(command("demo.load"));
  return e;
}
function open(e, n = 0) {
  return e.execute(command("order.open", { tableId: e.state.tables[n].id }))
    .orderId;
}
function change(e, id, type, p = {}) {
  const o = e.state.orders.find((o) => o.id === id);
  return e.execute(command(type, { orderId: id, version: o.version, ...p }));
}
function add(e, id, station = "kitchen", qty = 1) {
  const item = e.state.menu.find((m) => {
    if (m.station !== station || m.deleted) return false;
    if ((m.cookOptions || []).some((c) => !c.deleted)) return false;
    const category = e.state.categories.find((c) => c.name === m.category);
    const mode = ["none", "free", "paid", "mixed"].includes(m.sideMode)
      ? m.sideMode
      : category?.sideMode;
    return !mode || mode === "none";
  });
  change(e, id, "order.add", {
    menuId: item.id,
    qty,
    note: "No salt",
  });
}
test("food and drink tickets route separately; later sends contain additions only", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  add(e, id, "bar", 2);
  change(e, id, "order.send");
  assert.equal(e.state.jobs.length, 2);
  assert.equal(e.state.jobs[0].station, "kitchen");
  assert.equal(e.state.jobs[1].items[0].qty, 2);
  add(e, id);
  change(e, id, "order.send");
  assert.equal(e.state.jobs.length, 3);
  assert.equal(e.state.jobs[2].items.length, 1);
  e.close();
});
test("replayed command cannot create a duplicate order or ticket", () => {
  const e = setup(),
    c = command("order.open", { tableId: e.state.tables[0].id });
  assert.deepEqual(e.execute(c), e.execute(c));
  assert.equal(e.state.orders.length, 1);
  const id = e.state.orders[0].id;
  add(e, id);
  const send = command("order.send", { orderId: id, version: 1 });
  e.execute(send);
  e.execute(send);
  assert.equal(e.state.jobs.length, 1);
  e.close();
});
test("stale order version is rejected without partial mutation", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  const before = e.snapshot();
  assert.throws(
    () =>
      e.execute(
        command("order.add", {
          orderId: id,
          version: 0,
          menuId: e.state.menu[0].id,
          qty: 1,
        }),
      ),
    /changed/,
  );
  assert.deepEqual(e.snapshot(), before);
  e.close();
});
test("unsent quantity can change; sent lines cannot be edited in place", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  const item = e.state.orders[0].items[0];
  change(e, id, "order.qty", { itemId: item.id, qty: 3 });
  assert.equal(e.state.orders[0].items[0].qty, 3);
  change(e, id, "order.qty", { itemId: item.id, qty: 1 });
  assert.equal(e.state.orders[0].items[0].qty, 1);
  change(e, id, "order.send");
  assert.throws(
    () => change(e, id, "order.qty", { itemId: item.id, qty: 2 }),
    /sent/,
  );
  e.close();
});
test("sent cancellation queues a cancellation; unsent removal does not", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  let item = e.state.orders[0].items[0];
  change(e, id, "order.remove", { itemId: item.id });
  assert.equal(e.state.jobs.length, 0);
  add(e, id);
  change(e, id, "order.send");
  item = e.state.orders[0].items[0];
  change(e, id, "order.remove", {
    itemId: item.id,
  });
  assert.equal(e.state.jobs[1].kind, "CANCEL");
  assert.equal(total(e.state.orders[0]), 0);
  e.close();
});
test("waiter cannot edit configuration, delete sent items or cancel whole orders", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  change(e, id, "order.send");
  const actor = { id: "waiter", name: "Waiter", role: "waiter" };
  for (const type of [
    "menu.delete",
    "category.save",
    "settings.save",
    "order.void",
  ])
    assert.throws(() => e.execute(command(type, {}), actor), /Manager/);
  assert.throws(
    () =>
      e.execute(
        command("order.remove", {
          orderId: id,
          version: 2,
          itemId: e.state.orders[0].items[0].id,
          reason: "Test",
        }),
        actor,
      ),
    /manager/,
  );
  e.close();
});
test("categories are required for menu items and can be renamed", () => {
  const e = new Engine();
  assert.throws(
    () =>
      e.execute(
        command("menu.save", {
          name: "Soup",
          category: "Starters",
          price: 100,
          station: "kitchen",
          available: true,
        }),
      ),
    /category/,
  );
  e.execute(command("category.save", { name: "Starters" }));
  e.execute(
    command("menu.save", {
      name: "Soup",
      category: "Starters",
      price: 100,
      station: "kitchen",
      available: true,
    }),
  );
  assert.throws(
    () =>
      e.execute(command("category.delete", { id: e.state.categories[0].id })),
    /menu items/,
  );
  e.execute(
    command("category.save", {
      id: e.state.categories[0].id,
      name: "Soups",
    }),
  );
  assert.equal(e.state.menu[0].category, "Soups");
  e.execute(command("menu.delete", { id: e.state.menu[0].id }));
  e.execute(command("category.delete", { id: e.state.categories[0].id }));
  assert.equal(e.state.categories[0].deleted, true);
  e.close();
});
test("example data creates matching categories", () => {
  const e = setup();
  assert.deepEqual(
    e.state.categories
      .filter((c) => !c.deleted)
      .map((c) => c.name)
      .sort(),
    [...new Set(e.state.menu.map((m) => m.category))].sort(),
  );
  e.close();
});
test("occupied tables cannot be deleted and deleted tables drop out of order history", () => {
  const e = setup(),
    id = open(e),
    tableId = e.state.tables[0].id;
  assert.throws(
    () => e.execute(command("table.delete", { id: tableId })),
    /Close or move/,
  );
  change(e, id, "order.close", { payment: "cash" });
  e.execute(command("table.delete", { id: tableId }));
  assert.equal(e.state.tables[0].deleted, true);
  const deleted = new Set(
    e.state.tables.filter((t) => t.deleted).map((t) => t.id),
  );
  assert.equal(
    e.state.orders.filter((o) => !deleted.has(o.tableId)).length,
    0,
  );
  e.close();
});
test("close rejects unsent items and stores integer minor-unit totals", () => {
  const e = setup(),
    id = open(e);
  add(e, id, "kitchen", 3);
  assert.throws(
    () => change(e, id, "order.close", { payment: "cash" }),
    /Send or remove/,
  );
  change(e, id, "order.send");
  const totalBefore = total(e.state.orders[0]);
  change(e, id, "order.close", { payment: "card" });
  assert.equal(e.state.orders[0].paidTotal, totalBefore);
  assert.equal(e.state.orders[0].status, "paid");
  assert.equal(e.state.orders[0].payments[0].payment, "card");
  assert.throws(() => change(e, id, "order.add", {}), /closed/);
  e.close();
});
test("bill shares mark selected items paid, then close when the last share is taken", () => {
  const e = setup(),
    id = open(e);
  add(e, id, "kitchen", 2);
  add(e, id, "bar");
  const kitchen = e.state.orders[0].items[0];
  const drink = e.state.orders[0].items[1];
  assert.throws(
    () =>
      change(e, id, "order.payShare", {
        payment: "cash",
        items: [{ itemId: kitchen.id, qty: 1 }],
      }),
    /Send items/,
  );
  change(e, id, "order.send");
  const unit = unitAmount(e.state.orders[0].items[0]);
  const drinkAmount = unitAmount(e.state.orders[0].items[1]);
  const first = change(e, id, "order.payShare", {
    payment: "cash",
    items: [{ itemId: kitchen.id, qty: 1 }],
  });
  assert.equal(first.closed, false);
  assert.equal(first.amount, unit);
  assert.equal(e.state.orders[0].status, "open");
  assert.equal(e.state.orders[0].items[0].paidQty, 1);
  assert.equal(unpaidTotal(e.state.orders[0]), unit + drinkAmount);
  assert.throws(
    () =>
      change(e, id, "order.payShare", {
        payment: "card",
        items: [{ itemId: kitchen.id, qty: 2 }],
      }),
    /quantity/,
  );
  assert.throws(
    () => change(e, id, "order.remove", { itemId: kitchen.id }),
    /already been paid/,
  );
  assert.throws(
    () =>
      change(e, id, "order.split", {
        tableId: e.state.tables[1].id,
        itemIds: [kitchen.id],
      }),
    /Paid items/,
  );
  const last = change(e, id, "order.payShare", {
    payment: "card",
    items: [
      { itemId: kitchen.id, qty: 1 },
      { itemId: drink.id, qty: 1 },
    ],
  });
  assert.equal(last.closed, true);
  assert.equal(e.state.orders[0].status, "paid");
  assert.equal(e.state.orders[0].payment, "split");
  assert.equal(e.state.orders[0].paidTotal, unit * 2 + drinkAmount);
  assert.equal(unpaidTotal(e.state.orders[0]), 0);
  e.close();
});
test("closing after a share only charges the remaining unpaid items", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  add(e, id, "bar");
  change(e, id, "order.send");
  const food = e.state.orders[0].items[0];
  const drink = e.state.orders[0].items[1];
  const foodAmount = unitAmount(food);
  const drinkAmount = unitAmount(drink);
  change(e, id, "order.payShare", {
    payment: "cash",
    items: [{ itemId: food.id, qty: 1 }],
  });
  change(e, id, "order.close", { payment: "card" });
  assert.equal(e.state.orders[0].status, "paid");
  assert.equal(e.state.orders[0].payment, "split");
  assert.equal(e.state.orders[0].payments.length, 2);
  assert.equal(e.state.orders[0].payments[1].amount, drinkAmount);
  assert.equal(e.state.orders[0].paidTotal, foodAmount + drinkAmount);
  e.close();
});
test("menu price edits do not change existing lines; currency cannot relabel history", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  const amount = total(e.state.orders[0]);
  e.execute(command("menu.save", { ...e.state.menu[0], price: 9999 }));
  assert.equal(total(e.state.orders[0]), amount);
  assert.throws(
    () =>
      e.execute(
        command("settings.save", {
          settings: { ...e.state.settings, currency: "USD" },
        }),
      ),
    /Currency/,
  );
  e.close();
});
test("split and merge preserve totals and notify stations", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  add(e, id, "bar");
  change(e, id, "order.send");
  const amount = total(e.state.orders[0]),
    itemId = e.state.orders[0].items[0].id;
  const second = change(e, id, "order.split", {
    tableId: e.state.tables[1].id,
    itemIds: [itemId],
  }).orderId;
  assert.equal(total(e.state.orders[0]) + total(e.state.orders[1]), amount);
  change(e, second, "order.merge", {
    targetOrderId: id,
    targetVersion: e.state.orders[0].version,
  });
  assert.equal(total(e.state.orders[0]), amount);
  assert.equal(e.state.orders[1].status, "merged");
  assert.equal(e.state.jobs.length, 4);
  e.close();
});
test("failed validation rolls back settings, revisions and audit", () => {
  const e = setup(),
    before = e.snapshot();
  assert.throws(
    () =>
      e.execute(
        command("settings.save", {
          settings: { ...e.state.settings, currency: "!" },
        }),
      ),
    /currency/,
  );
  assert.deepEqual(e.snapshot(), before);
  e.close();
});
test("SQLite survives restart; interrupted spool becomes uncertain; dedupe survives too", () => {
  const dir = mkdtempSync(join(tmpdir(), "pos-test-")),
    p = join(dir, "pos.sqlite");
  let e = new Engine(p);
  e.execute(command("demo.load"));
  const c = command("order.open", { tableId: e.state.tables[0].id });
  const id = e.execute(c).orderId;
  add(e, id);
  change(e, id, "order.send");
  e.updateJob(e.state.jobs[0].id, { status: "printing" });
  e.close();
  e = new Engine(p);
  assert.equal(e.state.jobs[0].status, "uncertain");
  assert.equal(e.execute(c).orderId, id);
  assert.equal(e.state.orders.length, 1);
  e.close();
  rmSync(dir, { recursive: true });
});
test("pairing uses revocable hashed tokens and enforces roles over LAN", async () => {
  const e = setup();
  const pairing = e.pair("Phone", "waiter");
  const hub = await createHub(e, { host: "127.0.0.1", port: 0 });
  const url = `http://127.0.0.1:${hub.address().port}`;
  try {
    assert.equal((await fetch(url + "/api/state")).status, 401);
    let r = await fetch(url + "/api/state", {
      headers: { Authorization: `Bearer ${pairing.token}` },
    });
    const state = await r.json();
    assert.equal(state.actor.role, "waiter");
    assert.deepEqual(state.printers, {
      named: [],
      kitchen: "",
      bar: "",
      bill: "",
    });
    r = await fetch(url + "/api/command", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pairing.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command("demo.load")),
    });
    assert.equal(r.status, 403);
    e.revoke(pairing.id);
    assert.equal(
      (
        await fetch(url + "/api/state", {
          headers: { Authorization: `Bearer ${pairing.token}` },
        })
      ).status,
      401,
    );
  } finally {
    await new Promise((r) => hub.close(r));
    e.close();
  }
});
test("closing the desktop app requires the manager PIN once it is set", () => {
  assertManagerPin("", "");
  assert.throws(() => assertManagerPin(pinHash("2468"), "0000"), /Incorrect/);
  assert.doesNotThrow(() => assertManagerPin(pinHash("2468"), "2468"));
});
test("update feeds accept a folder URL or a GitHub repo", () => {
  assert.deepEqual(parseUpdateFeed("http://192.168.1.8:47831/updates"), {
    provider: "generic",
    url: "http://192.168.1.8:47831/updates/",
  });
  assert.deepEqual(parseUpdateFeed("github:angel/pos"), {
    provider: "github",
    owner: "angel",
    repo: "pos",
  });
  assert.deepEqual(
    parseUpdateFeed({
      provider: "github",
      owner: "OgnyanTatarov",
      repo: "restaurant-pos",
    }),
    {
      provider: "github",
      owner: "OgnyanTatarov",
      repo: "restaurant-pos",
    },
  );
  assert.equal(parseUpdateFeed(""), null);
});
test("the hub serves published Windows update files without pairing", async () => {
  const e = setup();
  const dir = mkdtempSync(join(tmpdir(), "pos-updates-"));
  writeFileSync(join(dir, "latest.yml"), "version: 1.1.0\n");
  const hub = await createHub(e, {
    host: "127.0.0.1",
    port: 0,
    updatesDir: dir,
  });
  const url = `http://127.0.0.1:${hub.address().port}`;
  try {
    const ok = await fetch(url + "/updates/latest.yml");
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "version: 1.1.0\n");
    assert.equal((await fetch(url + "/updates/missing.yml")).status, 404);
    assert.equal(
      (await fetch(url + "/updates/%2e%2e%2fsecret.yml")).status,
      404,
    );
  } finally {
    await new Promise((r) => hub.close(r));
    e.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("required sides and paid extras are copied onto the line and counted in totals", () => {
  const e = setup(),
    id = open(e),
    chicken = e.state.menu.find((m) => m.name === "Simply the Best"),
    mains = e.state.categories.find((c) => c.name === "Burgers"),
    fries = mains.sides.find((s) => s.name === "Fries"),
    extra = chicken.addonGroups
      .flatMap((group) => group.extras)
      .find((m) => m.name === "Cheese");
  assert.throws(
    () =>
      change(e, id, "order.add", {
        menuId: chicken.id,
        qty: 2,
      }),
    /side/,
  );
  change(e, id, "order.add", {
    menuId: chicken.id,
    qty: 2,
    sideId: fries.id,
    extraIds: [extra.id],
    leaveoutIds: [chicken.modifiers.find((m) => m.name === "Onion").id],
  });
  const line = e.state.orders[0].items[0];
  assert.equal(line.choices.side.name, "Fries");
  assert.equal(line.choices.side.price, 0);
  assert.equal(line.choices.extras[0].price, 100);
  assert.equal(line.choices.leaveouts[0].name, "Onion");
  assert.equal(total(e.state.orders[0]), (1595 + 0 + 100) * 2);
  e.execute(
    command("menu.save", {
      ...chicken,
      price: 9999,
      addonGroups: chicken.addonGroups.map((group) => ({
        ...group,
        extras: group.extras.map((m) => ({ ...m, price: 500 })),
      })),
    }),
  );
  e.execute(
    command("category.save", {
      ...mains,
      sides: mains.sides.map((s) => ({ ...s, price: 800 })),
    }),
  );
  assert.equal(total(e.state.orders[0]), (1595 + 0 + 100) * 2);
  change(e, id, "order.send");
  const html = ticketHtml(e.state.jobs[0], e.state.settings);
  assert.ok(html.includes("Side: Fries"));
  assert.ok(html.includes("+ Cheese"));
  assert.ok(html.includes("No Onion"));
  e.close();
});
test("one dish can offer both an included side and a paid side", () => {
  const e = setup(),
    id = open(e),
    chicken = e.state.menu.find((m) => m.name === "Simply the Best"),
    mains = e.state.categories.find((c) => c.name === "Burgers"),
    salad = mains.sides.find((s) => s.name === "Side salad"),
    angel = mains.sides.find((s) => s.name === "Jalapeño poppers");
  assert.equal(mains.sideMode, "mixed");
  change(e, id, "order.add", {
    menuId: chicken.id,
    qty: 1,
    sideId: salad.id,
  });
  assert.equal(e.state.orders[0].items[0].choices.side.price, 0);
  assert.equal(total(e.state.orders[0]), 1595);
  change(e, id, "order.add", {
    menuId: chicken.id,
    qty: 1,
    sideId: angel.id,
  });
  assert.equal(e.state.orders[0].items[1].choices.side.price, 300);
  assert.equal(total(e.state.orders[0]), 1595 + 1595 + 300);
  e.close();
});
test("menu photos must be compact JPEG or PNG data URLs", () => {
  const e = setup(),
    item = e.state.menu[0];
  assert.throws(
    () =>
      e.execute(
        command("menu.save", { ...item, image: "https://example.com/x.jpg" }),
      ),
    /photo/i,
  );
  const image = "data:image/jpeg;base64," + "A".repeat(40);
  e.execute(command("menu.save", { ...item, image }));
  assert.equal(e.state.menu[0].image, image);
  e.close();
});
test("manager PIN is hashed and waiters cannot change settings", () => {
  const e = setup();
  e.execute(
    command("settings.save", { settings: e.state.settings, pin: "2468" }),
  );
  const first = e.state.settings.managerPinHash;
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.ok(
    !e.state.audit.some((a) => JSON.stringify(a).includes("2468")),
  );
  e.execute(
    command("settings.save", { settings: e.state.settings, pin: "1357" }),
  );
  assert.notEqual(e.state.settings.managerPinHash, first);
  assert.throws(
    () =>
      e.execute(
        command("settings.save", { settings: e.state.settings, pin: "0000" }),
        { id: "waiter", name: "Waiter", role: "waiter" },
      ),
    /Manager/,
  );
  e.close();
});
test("steaks require a cooking choice that prints on the kitchen ticket", () => {
  const e = setup(),
    id = open(e),
    steak = e.state.menu.find((m) => m.name === "7 oz fillet steak"),
    mediumRare = steak.cookOptions.find((c) => c.name === "Medium rare"),
    ribs = e.state.menu.find((m) => m.name === "Pork ribs");
  assert.ok(steak.cookOptions.filter((c) => !c.deleted).length >= 6);
  assert.equal((ribs.cookOptions || []).filter((c) => !c.deleted).length, 0);
  assert.throws(
    () => change(e, id, "order.add", { menuId: steak.id, qty: 1 }),
    /cooked/,
  );
  change(e, id, "order.add", {
    menuId: steak.id,
    qty: 1,
    cookId: mediumRare.id,
  });
  assert.equal(e.state.orders[0].items[0].choices.cook.name, "Medium rare");
  change(e, id, "order.send");
  assert.ok(ticketHtml(e.state.jobs[0], e.state.settings).includes("Cook: Medium rare"));
  e.close();
});
test("existing steak dishes get cooking options on load", () => {
  const dir = mkdtempSync(join(tmpdir(), "pos-")),
    path = join(dir, "state.db");
  try {
    const e = new Engine(path);
    e.execute(command("demo.load"));
    const steak = e.state.menu.find((m) => m.name === "7 oz fillet steak");
    delete steak.cookOptions;
    e.persist();
    e.close();
    const next = new Engine(path);
    const migrated = next.state.menu.find((m) => m.name === "7 oz fillet steak");
    assert.ok(migrated.cookOptions.some((c) => c.name === "Medium rare"));
    next.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("kitchen tickets use a larger type size than bar tickets", () => {
  const settings = {
    name: "R",
    currency: "EUR",
    ticketFont: 20,
    paperWidth: 80,
    ticketFooter: "",
  };
  const kitchen = ticketHtml(
    {
      id: "1",
      station: "kitchen",
      kind: "NEW",
      tableName: "T1",
      createdAt: new Date().toISOString(),
      actor: "A",
      items: [
        {
          qty: 1,
          name: "Steak",
          choices: { cook: { name: "Rare" } },
        },
      ],
    },
    settings,
  );
  const bar = ticketHtml(
    {
      id: "2",
      station: "bar",
      kind: "NEW",
      tableName: "T1",
      createdAt: new Date().toISOString(),
      actor: "A",
      items: [{ qty: 1, name: "Beer" }],
    },
    settings,
  );
  assert.equal(ticketSizes(settings, "kitchen").body, 30);
  assert.equal(ticketSizes(settings, "bar").body, 20);
  assert.ok(kitchen.includes("font:30px"));
  assert.ok(bar.includes("font:20px"));
  assert.ok(kitchen.includes('class="cook"'));
});
test("order.printBill queues a guest bill for a named printer", () => {
  const e = setup(),
    id = open(e);
  add(e, id);
  change(e, id, "order.send");
  change(e, id, "order.printBill", { printerId: "upstairs" });
  const job = e.state.jobs.find((j) => j.station === "bill");
  assert.equal(job.kind, "BILL");
  assert.equal(job.printerId, "upstairs");
  const html = billHtml(job, e.state.settings);
  assert.ok(html.includes("BILL"));
  assert.ok(html.includes("GBP"));
  assert.ok(html.includes("Total"));
  e.execute(
    command("settings.save", {
      settings: { ...e.state.settings, ticketFont: 36 },
    }),
  );
  assert.equal(e.state.settings.ticketFont, 36);
  assert.throws(
    () =>
      e.execute(
        command("settings.save", {
          settings: { ...e.state.settings, ticketFont: 40 },
        }),
      ),
    /font/,
  );
  e.close();
});
test("named printers keep friendly names and a bill destination", () => {
  const config = normalizePrinters({
    named: [
      { id: "up", name: "Upstairs", device: "HP-Bar" },
      { id: "down", name: "Downstairs", device: "Epson-Kitchen" },
    ],
    kitchen: "down",
    bar: "up",
    bill: "up",
  });
  assert.equal(deviceForJob(config, { station: "kitchen" }), "Epson-Kitchen");
  assert.equal(
    deviceForJob(config, { station: "bill", printerId: "down" }),
    "Epson-Kitchen",
  );
  const legacy = normalizePrinters({ kitchen: "Old Kitchen", bar: "Old Bar" });
  assert.equal(legacy.named.length, 2);
  assert.equal(deviceForJob(legacy, { station: "kitchen" }), "Old Kitchen");
});
test("ticket text escapes user HTML and retains non-Latin characters", () => {
  const e = setup(),
    html = ticketHtml(
      {
        id: "test",
        station: "bar",
        kind: "NEW",
        tableName: "<script>x</script>",
        createdAt: new Date().toISOString(),
        actor: "Тест",
        items: [{ qty: 1, name: "<img onerror=x>", note: "Без лед" }],
      },
      e.state.settings,
    );
  assert.ok(!html.includes("<script>x"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("Без лед"));
  e.close();
});
