import { DatabaseSync } from "node:sqlite";
import { buildAngelMenu, steakCooks } from "./angel-menu.mjs";
import {
  randomUUID,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";

export class PosError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status) => {
  throw new PosError(message, status);
};
const text = (v, name, max = 160) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail(`Invalid ${name}`);
  return v.trim();
};
const integer = (v, name, min = 0, max = 10000000) => {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail(`Invalid ${name}`);
  return v;
};
const hash = (v) => createHash("sha256").update(v).digest("hex");
export const unitAmount = (i) => {
  const extras = (i.choices?.extras || []).reduce(
    (n, extra) => n + (extra.price || 0),
    0,
  );
  const side = i.choices?.side?.price || 0;
  return i.price + extras + side;
};
export const lineTotal = (i) => unitAmount(i) * i.qty;
export const unpaidQty = (i) =>
  i.voided ? 0 : Math.max(0, i.qty - (i.paidQty || 0));
export const unpaidTotal = (o) =>
  o.items.reduce((n, i) => n + unitAmount(i) * unpaidQty(i), 0);
export const total = (o) =>
  o.items.filter((i) => !i.voided).reduce((n, i) => n + lineTotal(i), 0);
const paymentLabel = (o) => {
  const methods = [...new Set((o.payments || []).map((p) => p.payment))];
  return methods.length === 1 ? methods[0] : methods.length ? "split" : "";
};
const collectedTotal = (o) =>
  (o.payments || []).reduce((n, p) => n + p.amount, 0);
const photo = (v) => {
  if (v == null || v === "") return "";
  if (typeof v !== "string") fail("Invalid photo");
  if (
    !v.startsWith("data:image/jpeg;base64,") &&
    !v.startsWith("data:image/png;base64,")
  )
    fail("Use a JPEG or PNG photo");
  const b64 = v.slice(v.indexOf(",") + 1);
  if (b64.length < 8) fail("Invalid photo");
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > 400 * 1024) fail("Photo is too large");
  return v;
};
const idList = (v, name) => {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`Invalid ${name}`);
  return [...new Set(v.map((id) => text(id, name, 80)))];
};
const parseSides = (list, mode) => {
  if (mode === "none") {
    if (!Array.isArray(list)) return [];
  } else if (!Array.isArray(list)) fail("Add at least one side");
  const sides = (list || []).slice(0, 40).map((side) => {
    if (!side || typeof side !== "object") fail("Invalid side");
    return {
      id:
        typeof side.id === "string" && side.id.trim()
          ? side.id.trim()
          : randomUUID(),
      name: text(side.name, "side name"),
      price:
        mode === "free" ? 0 : integer(side.price || 0, "side price"),
      deleted: !!side.deleted,
    };
  });
  if (mode !== "none" && !sides.some((side) => !side.deleted))
    fail("Add at least one side");
  return sides;
};
const parseModifiers = (list) => {
  if (list == null) return [];
  if (!Array.isArray(list)) fail("Invalid extras");
  return list.slice(0, 40).map((mod) => {
    if (!mod || typeof mod !== "object") fail("Invalid extra");
    if (!["extra", "leaveout"].includes(mod.kind)) fail("Invalid extra");
    return {
      id:
        typeof mod.id === "string" && mod.id.trim()
          ? mod.id.trim()
          : randomUUID(),
      name: text(mod.name, "extra name"),
      kind: mod.kind,
      price: mod.kind === "leaveout" ? 0 : integer(mod.price || 0, "extra price"),
      deleted: !!mod.deleted,
    };
  });
};
const parseAddon = (extra) => {
  if (!extra || typeof extra !== "object") fail("Invalid add-on");
  return {
    id:
      typeof extra.id === "string" && extra.id.trim()
        ? extra.id.trim()
        : randomUUID(),
    name: text(extra.name, "add-on name"),
    price: integer(extra.price || 0, "add-on price"),
    deleted: !!extra.deleted,
  };
};
const parseAddonGroups = (list) => {
  if (list == null) return [];
  if (!Array.isArray(list)) fail("Invalid add-on groups");
  return list.slice(0, 20).map((group) => {
    if (!group || typeof group !== "object") fail("Invalid add-on group");
    if (!Array.isArray(group.extras)) fail("Invalid add-ons");
    return {
      id:
        typeof group.id === "string" && group.id.trim()
          ? group.id.trim()
          : randomUUID(),
      name: text(group.name, "add-on group"),
      deleted: !!group.deleted,
      extras: group.extras.slice(0, 40).map(parseAddon),
    };
  });
};
const parseCookOptions = (list) => {
  if (list == null) return [];
  if (!Array.isArray(list)) fail("Invalid cooking options");
  return list.slice(0, 20).map((opt) => {
    if (!opt || typeof opt !== "object") fail("Invalid cooking option");
    return {
      id:
        typeof opt.id === "string" && opt.id.trim()
          ? opt.id.trim()
          : randomUUID(),
      name: text(opt.name, "cooking"),
      deleted: !!opt.deleted,
    };
  });
};
const findExtra = (item, extraId) => {
  for (const group of item.addonGroups || []) {
    if (group.deleted) continue;
    const extra = (group.extras || []).find(
      (x) => x.id === extraId && !x.deleted,
    );
    if (extra) return extra;
  }
  return (item.modifiers || []).find(
    (x) => x.id === extraId && !x.deleted && x.kind === "extra",
  );
};
const groupsFromExtras = (extras) =>
  extras.length
    ? [
        {
          id: randomUUID(),
          name: "Add-ons",
          deleted: false,
          extras: extras.map((extra) => ({
            id: extra.id,
            name: extra.name,
            price: extra.price,
            deleted: !!extra.deleted,
          })),
        },
      ]
    : [];
const parsePin = (v) => {
  if (v == null || v === "") return "";
  if (typeof v !== "string" || !/^\d{4,12}$/.test(v.trim()))
    fail("PIN must be 4 to 12 digits");
  return v.trim();
};
const sideModeOf = (item, category) => {
  if (["none", "free", "paid", "mixed"].includes(item?.sideMode))
    return item.sideMode;
  return category?.sideMode && category.sideMode !== "none"
    ? category.sideMode
    : "none";
};
const emptyCategory = (name) => ({
  id: randomUUID(),
  name,
  deleted: false,
  sideMode: "none",
  sides: [],
});
export function seed() {
  return {
    schema: 1,
    hubId: randomUUID(),
    revision: 0,
    settings: {
      name: "Your restaurant",
      currency: "EUR",
      accent: "#16766b",
      ticketFooter: "Thank you",
      ticketFont: 20,
      paperWidth: 80,
      managerPinHash: "",
    },
    tables: [],
    categories: [],
    menu: [],
    orders: [],
    jobs: [],
    audit: [],
  };
}
export class Engine {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,actor TEXT NOT NULL,result TEXT NOT NULL); CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,hash TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);",
    );
    if (!this.db.prepare("SELECT 1 FROM state").get())
      this.db
        .prepare("INSERT INTO state VALUES(1,?)")
        .run(JSON.stringify(seed()));
    this.state = JSON.parse(
      this.db.prepare("SELECT json FROM state WHERE id=1").get().json,
    );
    if (!Array.isArray(this.state.categories)) {
      const seen = new Set();
      this.state.categories = [];
      for (const item of this.state.menu || []) {
        const name = typeof item.category === "string" ? item.category.trim() : "";
        if (!name || seen.has(name)) continue;
        seen.add(name);
        this.state.categories.push(emptyCategory(name));
      }
      this.persist();
    }
    let migrated = false;
    if (typeof this.state.settings.managerPinHash !== "string") {
      this.state.settings.managerPinHash = "";
      migrated = true;
    }
    for (const category of this.state.categories || []) {
      if (!["none", "free", "paid", "mixed"].includes(category.sideMode)) {
        category.sideMode = "none";
        migrated = true;
      }
      if (!Array.isArray(category.sides)) {
        category.sides = [];
        migrated = true;
      }
    }
    for (const item of this.state.menu || []) {
      if (typeof item.image !== "string") {
        item.image = "";
        migrated = true;
      }
      if (!Array.isArray(item.modifiers)) {
        item.modifiers = [];
        migrated = true;
      }
      if (!Array.isArray(item.addonGroups)) {
        const extras = (item.modifiers || []).filter(
          (mod) => mod.kind === "extra",
        );
        item.modifiers = (item.modifiers || []).filter(
          (mod) => mod.kind !== "extra",
        );
        item.addonGroups = groupsFromExtras(extras);
        migrated = true;
      }
      if (!["inherit", "none", "free", "paid", "mixed"].includes(item.sideMode)) {
        item.sideMode = "inherit";
        migrated = true;
      }
      if (!Array.isArray(item.cookOptions)) {
        item.cookOptions = /\bsteak\b/i.test(item.name || "")
          ? steakCooks()
          : [];
        migrated = true;
      }
    }
    if (migrated) this.persist();
    // A crash while spooling is ambiguous: never silently print it twice.
    if (this.state.jobs.some((j) => j.status === "printing")) {
      this.state.jobs
        .filter((j) => j.status === "printing")
        .forEach((j) => {
          j.status = "uncertain";
          j.error =
            "Application stopped during printing. Check paper before reprinting.";
        });
      this.persist();
    }
  }
  persist() {
    this.db
      .prepare("UPDATE state SET json=? WHERE id=1")
      .run(JSON.stringify(this.state));
  }
  close() {
    this.db.close();
  }
  snapshot() {
    return structuredClone(this.state);
  }
  devices() {
    return this.db.prepare("SELECT id,name,role,revoked FROM devices").all();
  }
  pair(name, role = "waiter") {
    text(name, "device name");
    if (!["waiter", "manager"].includes(role)) fail("Invalid role");
    const token = randomBytes(32).toString("hex"),
      id = randomUUID();
    this.db
      .prepare("INSERT INTO devices(id,name,role,hash) VALUES(?,?,?,?)")
      .run(id, name, role, hash(token));
    return { id, name, role, token };
  }
  revoke(id) {
    this.db.prepare("UPDATE devices SET revoked=1 WHERE id=?").run(id);
  }
  authenticate(token) {
    if (typeof token !== "string" || token.length !== 64) return null;
    const h = hash(token);
    for (const d of this.db
      .prepare("SELECT * FROM devices WHERE revoked=0")
      .all()) {
      if (timingSafeEqual(Buffer.from(h), Buffer.from(d.hash)))
        return { id: d.id, name: d.name, role: d.role };
    }
    return null;
  }
  execute(
    command,
    actor = { id: "desktop", name: "Desktop manager", role: "manager" },
  ) {
    if (!command || typeof command !== "object") fail("Invalid command");
    const { id, type, payload: p = {} } = command;
    text(id, "command ID", 100);
    text(type, "command type", 50);
    const previous = this.db
      .prepare("SELECT actor,result FROM commands WHERE id=?")
      .get(id);
    if (previous) {
      if (previous.actor !== actor.id)
        fail("Command ID belongs to another device", 409);
      return JSON.parse(previous.result);
    }
    if (
      actor.role !== "manager" &&
      [
        "menu.save",
        "menu.delete",
        "category.save",
        "category.delete",
        "table.save",
        "table.delete",
        "settings.save",
        "order.void",
        "job.retry",
        "job.resolve",
        "demo.load",
        "menu.replace",
      ].includes(type)
    )
      fail("Manager permission required", 403);
    const before = this.snapshot();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const s = this.state;
      let result = {};
      const now = new Date().toISOString();
      const order = () => {
        const o = s.orders.find((o) => o.id === p.orderId);
        if (!o) fail("Order not found", 404);
        if (o.status !== "open") fail("Order is already closed", 409);
        if (p.version !== o.version)
          fail(
            "This order changed on another device. Refresh and try again.",
            409,
          );
        return o;
      };
      const table = (id) => {
        const t = s.tables.find((t) => t.id === id && !t.deleted);
        if (!t) fail("Table not found");
        return t;
      };
      const log = (action, detail) =>
        s.audit.push({
          id: randomUUID(),
          at: now,
          actor: actor.name,
          action,
          detail,
        });
      const ticket = (o, items, kind) => {
        for (const station of ["kitchen", "bar"]) {
          const lines = items.filter((i) => i.station === station);
          if (lines.length)
            s.jobs.push({
              id: randomUUID(),
              orderId: o.id,
              tableName: o.tableName,
              station,
              kind,
              items: structuredClone(lines),
              status: "queued",
              createdAt: now,
              attempts: 0,
              error: "",
              actor: actor.name,
            });
        }
      };
      const applyShare = (o, payment, selections) => {
        if (!["cash", "card", "other"].includes(payment))
          fail("Choose payment method");
        if (!Array.isArray(selections) || !selections.length)
          fail("Select items to pay");
        const seen = new Set();
        const paidItems = [];
        let amount = 0;
        for (const sel of selections.slice(0, 200)) {
          if (!sel || typeof sel !== "object") fail("Invalid share item");
          const itemId = text(sel.itemId, "item");
          if (seen.has(itemId)) fail("Duplicate item in share");
          seen.add(itemId);
          const i = o.items.find((x) => x.id === itemId && !x.voided);
          if (!i) fail("Item not found");
          if (!i.sent) fail("Send items before taking payment for them");
          const left = unpaidQty(i);
          if (!left) fail("That item is already paid");
          const qty = integer(sel.qty, "quantity", 1, left);
          i.paidQty = (i.paidQty || 0) + qty;
          const line = unitAmount(i) * qty;
          amount += line;
          paidItems.push({ id: i.id, name: i.name, qty, amount: line });
        }
        if (seen.size !== selections.length) fail("Invalid share selection");
        if (!amount) fail("Share total must be greater than zero");
        o.payments = o.payments || [];
        o.payments.push({
          id: randomUUID(),
          at: now,
          payment,
          amount,
          items: paidItems,
        });
        o.paidTotal = collectedTotal(o);
        return amount;
      };
      const closePaidOrder = (o, fallbackPayment) => {
        o.status = "paid";
        o.payment = paymentLabel(o) || fallbackPayment;
        o.paidTotal = collectedTotal(o);
        o.closedAt = now;
      };
      switch (type) {
        case "demo.load": {
          if (
            s.tables.length ||
            s.menu.length ||
            s.orders.length ||
            s.categories.length
          )
            fail("Example data is available only in an empty restaurant");
          const angel = buildAngelMenu();
          s.tables = Array.from({ length: 8 }, (_, i) => ({
            id: randomUUID(),
            name: `Table ${i + 1}`,
            room: i < 6 ? "Main room" : "Terrace",
            seats: i % 3 === 0 ? 4 : 2,
            deleted: false,
          }));
          s.settings = {
            ...s.settings,
            name: angel.settings.name,
            currency: angel.settings.currency,
          };
          s.categories = angel.categories;
          s.menu = angel.menu;
          break;
        }
        case "menu.replace": {
          if (s.orders.some((o) => o.status === "open"))
            fail("Close open orders before replacing the menu");
          const angel = buildAngelMenu();
          s.categories = angel.categories;
          s.menu = angel.menu;
          s.settings = {
            ...s.settings,
            name: angel.settings.name,
            ...(s.orders.length
              ? {}
              : { currency: angel.settings.currency }),
          };
          break;
        }
        case "settings.save": {
          const q = p.settings;
          if (
            s.orders.length &&
            q.currency.toUpperCase() !== s.settings.currency
          )
            fail(
              "Currency cannot change after orders exist. Keep historical amounts in their original currency.",
            );
          let managerPinHash = s.settings.managerPinHash || "";
          const nextPin = parsePin(p.pin ?? q.pin);
          if (nextPin) managerPinHash = hash(nextPin);
          s.settings = {
            name: text(q.name, "restaurant name"),
            currency: text(q.currency, "currency", 3).toUpperCase(),
            accent: /^#[0-9a-f]{6}$/i.test(q.accent) ? q.accent : "#16766b",
            ticketFooter: String(q.ticketFooter || "").slice(0, 300),
            ticketFont: integer(q.ticketFont, "font size", 10, 36),
            paperWidth: [58, 80].includes(q.paperWidth) ? q.paperWidth : 80,
            managerPinHash,
          };
          if (!/^[A-Z]{3}$/.test(s.settings.currency))
            fail("Use a three-letter currency code");
          break;
        }
        case "table.save": {
          const existing = s.tables.find((t) => t.id === p.id && !t.deleted);
          if (p.id && !existing) fail("Table not found");
          const data = {
            name: text(p.name, "table name"),
            room: text(p.room, "room"),
            seats: integer(p.seats, "seats", 1, 50),
          };
          if (existing) {
            Object.assign(existing, data);
            s.orders
              .filter((o) => o.tableId === existing.id && o.status === "open")
              .forEach((o) => {
                o.tableName = data.name;
                o.version++;
              });
          } else s.tables.push({ id: randomUUID(), ...data, deleted: false });
          break;
        }
        case "table.delete": {
          const t = table(p.id);
          if (s.orders.some((o) => o.tableId === t.id && o.status === "open"))
            fail("Close or move the active order first");
          t.deleted = true;
          break;
        }
        case "category.save": {
          const existing = s.categories.find((c) => c.id === p.id && !c.deleted);
          if (p.id && !existing) fail("Category not found");
          const name = text(p.name, "category name");
          if (
            s.categories.some(
              (c) =>
                !c.deleted &&
                c.name.toLowerCase() === name.toLowerCase() &&
                c.id !== existing?.id,
            )
          )
            fail("A category with this name already exists");
          const sideMode = ["none", "free", "paid", "mixed"].includes(p.sideMode)
            ? p.sideMode
            : existing?.sideMode || "none";
          const sides = parseSides(p.sides ?? existing?.sides, sideMode);
          if (existing) {
            const previous = existing.name;
            existing.name = name;
            existing.sideMode = sideMode;
            existing.sides = sides;
            if (previous !== name)
              s.menu
                .filter((m) => m.category === previous)
                .forEach((m) => {
                  m.category = name;
                });
          } else
            s.categories.push({
              id: randomUUID(),
              name,
              deleted: false,
              sideMode,
              sides,
            });
          break;
        }
        case "category.delete": {
          const c = s.categories.find((c) => c.id === p.id && !c.deleted);
          if (!c) fail("Category not found");
          if (s.menu.some((m) => !m.deleted && m.category === c.name))
            fail("Move or delete the menu items in this category first");
          c.deleted = true;
          break;
        }
        case "menu.save": {
          const existing = s.menu.find((m) => m.id === p.id && !m.deleted);
          if (p.id && !existing) fail("Menu item not found");
          if (!["kitchen", "bar"].includes(p.station))
            fail("Choose kitchen or bar");
          const category = text(p.category, "category");
          if (!s.categories.some((c) => !c.deleted && c.name === category))
            fail("Choose a category");
          const modifiers = parseModifiers(
            p.modifiers ?? existing?.modifiers,
          ).filter((mod) => mod.kind === "leaveout");
          let addonGroups = parseAddonGroups(
            p.addonGroups ?? existing?.addonGroups,
          );
          const leftover = parseModifiers(p.modifiers ?? []).filter(
            (mod) => mod.kind === "extra" && !mod.deleted,
          );
          if (
            leftover.length &&
            !addonGroups.some(
              (group) =>
                !group.deleted && group.extras.some((extra) => !extra.deleted),
            )
          )
            addonGroups = [...groupsFromExtras(leftover), ...addonGroups];
          const data = {
            name: text(p.name, "item name"),
            category,
            price: integer(p.price, "price"),
            station: p.station,
            available: !!p.available,
            image: photo(p.image ?? existing?.image),
            modifiers,
            addonGroups,
            cookOptions: parseCookOptions(
              p.cookOptions ?? existing?.cookOptions,
            ),
            sideMode: ["inherit", "none", "free", "paid", "mixed"].includes(
              p.sideMode,
            )
              ? p.sideMode
              : existing?.sideMode || "inherit",
          };
          if (existing) Object.assign(existing, data);
          else s.menu.push({ id: randomUUID(), ...data, deleted: false });
          break;
        }
        case "menu.delete": {
          const m = s.menu.find((m) => m.id === p.id);
          if (!m) fail("Item not found");
          m.deleted = true;
          break;
        }
        case "order.open": {
          const t = table(p.tableId);
          if (s.orders.some((o) => o.tableId === t.id && o.status === "open"))
            fail("This table already has an open order", 409);
          const o = {
            id: randomUUID(),
            tableId: t.id,
            tableName: t.name,
            status: "open",
            version: 0,
            items: [],
            createdAt: now,
            openedBy: actor.name,
          };
          s.orders.push(o);
          result = { orderId: o.id };
          break;
        }
        case "order.add": {
          const o = order(),
            m = s.menu.find(
              (m) => m.id === p.menuId && !m.deleted && m.available,
            );
          if (!m) fail("Menu item is unavailable");
          const category = s.categories.find(
            (c) => !c.deleted && c.name === m.category,
          );
          const sides = (category?.sides || []).filter((side) => !side.deleted);
          const sideId = p.sideId || p.choices?.side?.id;
          const requiredSide = sideModeOf(m, category);
          let side;
          if (requiredSide !== "none") {
            side = sides.find((x) => x.id === sideId);
            if (!side) fail("Choose a side");
            side = {
              id: side.id,
              name: side.name,
              price: requiredSide === "free" ? 0 : side.price,
            };
          }
          const extras = [];
          for (const extraId of idList(
            p.extraIds ?? (p.choices?.extras || []).map((x) => x.id),
            "extra",
          )) {
            const extra = findExtra(m, extraId);
            if (!extra) fail("Invalid extra");
            extras.push({
              id: extra.id,
              name: extra.name,
              price: extra.price,
            });
          }
          const leaveouts = [];
          for (const leaveId of idList(
            p.leaveoutIds ?? (p.choices?.leaveouts || []).map((x) => x.id),
            "leave-out",
          )) {
            const mod = (m.modifiers || []).find(
              (x) => x.id === leaveId && !x.deleted && x.kind === "leaveout",
            );
            if (!mod) fail("Invalid leave-out");
            leaveouts.push({ id: mod.id, name: mod.name });
          }
          const cooks = (m.cookOptions || []).filter((c) => !c.deleted);
          let cook;
          if (cooks.length) {
            const cookId = p.cookId || p.choices?.cook?.id;
            cook = cooks.find((x) => x.id === cookId);
            if (!cook) fail("Choose how it's cooked");
            cook = { id: cook.id, name: cook.name };
          }
          o.items.push({
            id: randomUUID(),
            menuId: m.id,
            name: m.name,
            price: m.price,
            station: m.station,
            qty: integer(p.qty, "quantity", 1, 99),
            note: String(p.note || "").slice(0, 300),
            sent: false,
            voided: false,
            paidQty: 0,
            choices: {
              ...(cook ? { cook } : {}),
              ...(side ? { side } : {}),
              extras,
              leaveouts,
            },
          });
          o.version++;
          break;
        }
        case "order.qty": {
          const o = order(),
            i = o.items.find((i) => i.id === p.itemId && !i.voided);
          if (!i) fail("Item not found");
          if (i.sent) fail("Add a new line for extra sent items");
          i.qty = integer(p.qty, "quantity", 1, 99);
          o.version++;
          break;
        }
        case "order.remove": {
          const o = order(),
            i = o.items.find((i) => i.id === p.itemId && !i.voided);
          if (!i) fail("Item not found");
          if ((i.paidQty || 0) > 0)
            fail("Cannot cancel an item that has already been paid");
          if (i.sent) {
            if (actor.role !== "manager")
              fail("A manager must cancel sent items", 403);
            ticket(o, [{ ...i }], "CANCEL");
            i.voided = true;
          } else o.items = o.items.filter((x) => x.id !== i.id);
          o.version++;
          break;
        }
        case "order.send": {
          const o = order(),
            items = o.items.filter((i) => !i.sent && !i.voided);
          if (!items.length) fail("No new items to send");
          ticket(o, items, "NEW");
          items.forEach((i) => (i.sent = true));
          o.version++;
          break;
        }
        case "order.move": {
          const o = order(),
            t = table(p.tableId);
          if (s.orders.some((x) => x.tableId === t.id && x.status === "open"))
            fail("Destination table is occupied");
          const old = o.tableName;
          const sent = o.items.filter((i) => i.sent && !i.voided);
          ticket(o, sent, `MOVE TO ${t.name}`);
          o.tableId = t.id;
          o.tableName = t.name;
          o.version++;
          log("Table moved", `${old} → ${t.name}`);
          break;
        }
        case "order.merge": {
          const o = order(),
            target = s.orders.find(
              (x) =>
                x.id === p.targetOrderId &&
                x.status === "open" &&
                x.id !== o.id,
            );
          if (!target || target.version !== p.targetVersion)
            fail("Destination order changed or is unavailable", 409);
          ticket(
            o,
            o.items.filter((i) => i.sent && !i.voided),
            `MERGE INTO ${target.tableName}`,
          );
          target.items.push(...o.items);
          target.payments = [...(target.payments || []), ...(o.payments || [])];
          target.paidTotal = collectedTotal(target);
          target.version++;
          o.items = [];
          o.status = "merged";
          o.mergedInto = target.id;
          o.closedAt = now;
          o.version++;
          break;
        }
        case "order.split": {
          const o = order(),
            t = table(p.tableId);
          if (s.orders.some((x) => x.tableId === t.id && x.status === "open"))
            fail("Destination table is occupied");
          if (!Array.isArray(p.itemIds) || !p.itemIds.length)
            fail("Select items to split");
          const items = o.items.filter(
            (i) => p.itemIds.includes(i.id) && !i.voided,
          );
          if (items.length !== new Set(p.itemIds).size)
            fail("Invalid split selection");
          if (items.some((i) => (i.paidQty || 0) > 0))
            fail("Paid items stay on this bill");
          const next = {
            ...o,
            id: randomUUID(),
            tableId: t.id,
            tableName: t.name,
            items: structuredClone(items),
            version: 0,
            createdAt: now,
            payments: undefined,
            paidTotal: undefined,
            payment: undefined,
          };
          ticket(
            o,
            items.filter((i) => i.sent),
            `SPLIT TO ${t.name}`,
          );
          o.items = o.items.filter((i) => !p.itemIds.includes(i.id));
          o.version++;
          s.orders.push(next);
          result = { orderId: next.id };
          break;
        }
        case "order.payShare": {
          const o = order();
          const amount = applyShare(o, p.payment, p.items);
          const closed = unpaidTotal(o) === 0;
          if (closed) closePaidOrder(o, p.payment);
          o.version++;
          result = { amount, closed };
          break;
        }
        case "order.close": {
          const o = order();
          if (o.items.some((i) => !i.sent && !i.voided))
            fail("Send or remove new items before closing");
          const remaining = o.items
            .filter((i) => unpaidQty(i) > 0)
            .map((i) => ({ itemId: i.id, qty: unpaidQty(i) }));
          if (remaining.length) applyShare(o, p.payment, remaining);
          else if (
            p.payment &&
            !["cash", "card", "other"].includes(p.payment)
          )
            fail("Choose payment method");
          closePaidOrder(o, p.payment);
          o.version++;
          break;
        }
        case "order.printBill": {
          const o = order();
          const items = o.items.filter((i) => !i.voided);
          if (!items.length) fail("Add items before printing a bill");
          const printerId =
            typeof p.printerId === "string"
              ? p.printerId.trim().slice(0, 80)
              : "";
          s.jobs.push({
            id: randomUUID(),
            orderId: o.id,
            tableName: o.tableName,
            station: "bill",
            kind: "BILL",
            items: structuredClone(items),
            status: "queued",
            createdAt: now,
            attempts: 0,
            error: "",
            actor: actor.name,
            printerId,
            amount: unpaidTotal(o),
            total: total(o),
          });
          break;
        }
        case "order.void": {
          const o = order();
          ticket(
            o,
            o.items.filter((i) => i.sent && !i.voided),
            "CANCEL ORDER",
          );
          o.status = o.items.some((i) => i.sent) ? "void" : "deleted";
          o.closedAt = now;
          o.version++;
          break;
        }
        case "job.retry": {
          const j = s.jobs.find((j) => j.id === p.id);
          if (!j) fail("Print job not found");
          if (j.status === "printing" || j.status === "queued")
            fail("Job is already queued or printing");
          s.jobs.push({
            ...structuredClone(j),
            id: randomUUID(),
            kind: `REPRINT ${j.kind.replace(/^REPRINT /, "")}`,
            status: "queued",
            createdAt: now,
            attempts: 0,
            error: "",
            originalId: j.id,
          });
          break;
        }
        case "job.resolve": {
          const j = s.jobs.find((j) => j.id === p.id);
          if (!j || !["error", "uncertain"].includes(j.status))
            fail("Only failed or uncertain jobs can be resolved");
          j.status = "resolved";
          j.resolution = text(p.reason, "resolution");
          break;
        }
        default:
          fail("Unknown command");
      }
      s.revision++;
      const logged =
        type === "settings.save" && (p.pin || p.settings?.pin)
          ? { ...p, pin: "****", settings: { ...p.settings, pin: undefined } }
          : p;
      log(type, JSON.stringify(logged));
      this.persist();
      const response = { ...result, revision: s.revision };
      this.db
        .prepare("INSERT INTO commands VALUES(?,?,?)")
        .run(id, actor.id, JSON.stringify(response));
      this.db.exec("COMMIT");
      return response;
    } catch (e) {
      this.db.exec("ROLLBACK");
      this.state = before;
      throw e;
    }
  }
  updateJob(id, patch) {
    const j = this.state.jobs.find((j) => j.id === id);
    if (!j) fail("Job not found");
    Object.assign(j, patch);
    this.state.revision++;
    this.persist();
  }
}
