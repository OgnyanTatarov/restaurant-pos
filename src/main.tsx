import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutGrid,
  UtensilsCrossed,
  ReceiptText,
  Printer,
  Settings,
  Plus,
  Minus,
  Search,
  ArrowLeft,
  Trash2,
  Send,
  Check,
  RefreshCw,
  Smartphone,
  Wifi,
  Monitor,
  Download,
  X,
  ArrowRightLeft,
  Scissors,
  History,
  ChevronRight,
  ChevronsUpDown,
  LockKeyhole,
  Tags,
  BarChart3,
  ImagePlus,
  Users,
} from "lucide-react";
import {
  desktop,
  connection,
  configure,
  ipc,
  getState,
  submit,
  cached,
  pending,
  login,
  emptyPrinters,
} from "./client";
import type {
  State,
  Order,
  MenuItem,
  Table,
  Category,
  Actor,
  Station,
  Connection,
  Item,
  Modifier,
  Side,
  AddonGroup,
  CookOption,
  PrinterAssignments,
  NamedPrinter,
} from "./types";
import "./style.css";
const unitAmount = (i: Item) => {
  const extras = (i.choices?.extras || []).reduce(
    (n, extra) => n + extra.price,
    0,
  );
  return i.price + (i.choices?.side?.price || 0) + extras;
};
const lineAmount = (i: Item) => unitAmount(i) * i.qty;
const unpaidQty = (i: Item) =>
  i.voided ? 0 : Math.max(0, i.qty - (i.paidQty || 0));
const unpaidAmount = (i: Item) => unitAmount(i) * unpaidQty(i);
const sum = (o: Order) =>
  o.items.filter((i) => !i.voided).reduce((n, i) => n + lineAmount(i), 0);
const due = (o: Order) => o.items.reduce((n, i) => n + unpaidAmount(i), 0);
const STEAK_COOKS = [
  "Blue",
  "Rare",
  "Medium rare",
  "Medium",
  "Medium well",
  "Well done",
];
const choiceLines = (i: Item) => {
  const lines: string[] = [];
  if (i.choices?.cook) lines.push(i.choices.cook.name);
  if (i.choices?.side) lines.push(i.choices.side.name);
  for (const extra of i.choices?.extras || []) lines.push(`+ ${extra.name}`);
  for (const leave of i.choices?.leaveouts || []) lines.push(`No ${leave.name}`);
  return lines;
};
async function pinHash(pin: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pin),
  );
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function addonGroupsOf(item?: MenuItem): AddonGroup[] {
  if (item?.addonGroups?.length)
    return item.addonGroups
      .filter((group) => !group.deleted)
      .map((group) => ({
        ...group,
        extras: (group.extras || []).filter((extra) => !extra.deleted),
      }));
  const extras = (item?.modifiers || []).filter(
    (m) => !m.deleted && m.kind === "extra",
  );
  if (!extras.length) return [];
  return [
    {
      id: crypto.randomUUID(),
      name: "Add-ons",
      deleted: false,
      extras: extras.map((extra) => ({
        id: extra.id,
        name: extra.name,
        price: extra.price,
        deleted: false,
      })),
    },
  ];
}
function resizePhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read photo"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read photo"));
    };
    img.src = url;
  });
}
const date = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div className="veil">
      <section
        className={"modal" + (wide ? " wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [data, setData] = useState<{ state: State; actor: Actor } | null>(
    desktop ? null : cached(),
  );
  const [page, setPage] = useState("floor");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [modal, setModal] = useState<React.ReactNode>(null);
  const [setup, setSetup] = useState(!desktop && !connection.url);
  const [query, setQuery] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<string[]>([]);
  const [category, setCategory] = useState("All");
  const [room, setRoom] = useState("All rooms");
  const [split, setSplit] = useState<string[]>([]);
  const [shareBill, setShareBill] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [unresolved, setUnresolved] = useState(pending());
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [printers, setPrinters] =
    useState<PrinterAssignments>(emptyPrinters);
  const refresh = useCallback(async () => {
    try {
      const next = await getState();
      setData((previous) =>
        previous && previous.state.revision > next.state.revision
          ? previous
          : next,
      );
      setPrinters(next.printers || emptyPrinters);
      setOnline(true);
    } catch (e) {
      setOnline(false);
      if (!data) setError((e as Error).message);
    }
  }, [!!data]);
  useEffect(() => {
    if (setup) return;
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [setup, refresh]);
  useEffect(() => {
    if (!desktop) return;
    const load = () =>
      ipc("info")
        .then(setInfo)
        .catch((e) => {
          if (page === "settings") setError(e.message);
        });
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [desktop, page]);
  async function act(
    type: string,
    payload: Record<string, unknown> = {},
    message = "Saved",
  ) {
    if (actionInFlight.current) return;
    if (!online) {
      setError("Reconnect before changing restaurant data.");
      return null;
    }
    actionInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await submit(type, payload);
      await refresh();
      setNotice(message);
      setTimeout(() => setNotice(""), 3500);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      actionInFlight.current = false;
      setBusy(false);
      setUnresolved(pending());
    }
  }
  const s = data?.state,
    actor = data?.actor,
    manager = actor?.role === "manager";
  const money = (v: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: s?.settings.currency || "EUR",
      }).format(v / 100);
    } catch {
      return `${(v / 100).toFixed(2)} ${s?.settings.currency}`;
    }
  };
  const order = s?.orders.find((o) => o.id === selected && o.status === "open");
  const tables = s?.tables.filter((t) => !t.deleted) || [];
  const menu = s?.menu.filter((m) => !m.deleted) || [];
  const categories = (s?.categories || []).filter((c) => !c.deleted);
  const categoryNames = [
    ...categories.map((c) => c.name),
    ...[...new Set(menu.map((m) => m.category))].filter(
      (name) => !categories.some((c) => c.name === name),
    ),
  ];
  const open = s?.orders.filter((o) => o.status === "open") || [];
  const deletedTables = new Set(
    (s?.tables || []).filter((t) => t.deleted).map((t) => t.id),
  );
  const history =
    s?.orders.filter(
      (o) =>
        !deletedTables.has(o.tableId) &&
        o.status !== "deleted" &&
        o.status !== "void",
    ) || [];
  function confirmAction(
    title: string,
    description: string,
    fn: () => Promise<any>,
    reason = false,
  ) {
    setModal(
      <Confirm
        title={title}
        description={description}
        reason={reason}
        onClose={() => setModal(null)}
        onConfirm={async (r) => {
          const result = await fnWithReason(r);
          if (result) setModal(null);
        }}
      />,
    );
    async function fnWithReason(r: string) {
      return reason ? (fn as any)(r) : fn();
    }
  }
  function editTable(t?: Table) {
    setModal(
      <TableForm
        table={t}
        onClose={() => setModal(null)}
        onSave={async (p) => {
          if (await act("table.save", p)) setModal(null);
        }}
      />,
    );
  }
  function editMenu(m?: MenuItem) {
    setModal(
      <MenuForm
        item={m}
        categories={categoryNames}
        onClose={() => setModal(null)}
        onSave={async (p) => {
          if (await act("menu.save", p)) setModal(null);
        }}
      />,
    );
  }
  function editCategory(c?: Category) {
    setModal(
      <CategoryForm
        category={c}
        onClose={() => setModal(null)}
        onSave={async (p) => {
          if (await act("category.save", p)) setModal(null);
        }}
      />,
    );
  }
  async function chooseTable(t: Table) {
    const o = open.find((o) => o.tableId === t.id);
    if (o) {
      setSelected(o.id);
      setSplit([]);
    } else {
      const r = await act("order.open", { tableId: t.id }, "Table opened");
      if (r) setSelected(r.orderId);
    }
  }
  const nav = (
    [
      ["floor", "Floor", LayoutGrid],
      ["menu", "Menu", UtensilsCrossed],
      ["categories", "Categories", Tags],
      ["orders", "Orders", ReceiptText],
      ["printing", "Tickets", Printer],
      ["analytics", "Analytics", BarChart3],
      ["settings", "Settings", Settings],
    ] as const
  ).filter(([key]) => manager || (key !== "settings" && key !== "analytics"));
  if (setup)
    return (
      <Connect
        onDone={() => {
          setSetup(false);
          setUnresolved(pending());
          setData(null);
          setError("");
        }}
      />
    );
  return (
    <div
      className="app"
      style={
        { "--accent": s?.settings.accent || "#16766b" } as React.CSSProperties
      }
    >
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <UtensilsCrossed />
          </div>
          <span>
            Restaurant<span className="brand-light">POS</span>
          </span>
        </div>
        <div className="workspace-label">SERVICE WORKSPACE</div>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => {
                setPage(key);
                setSelected(null);
                setQuery("");
              }}
            >
              <Icon size={20} />
              {label}
              {key === "printing" &&
                s?.jobs.some((j) =>
                  ["error", "uncertain"].includes(j.status),
                ) && <span className="nav-count">!</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar">{manager ? "M" : "W"}</div>
          <div>
            <strong>{actor?.name || "Connecting"}</strong>
            <small>{manager ? "Manager" : "Waiter"}</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">
              {s?.settings.name || "Restaurant POS"}
            </span>
            <h1>
              {order && page === "floor"
                ? order.tableName
                : (
                    {
                      floor: "Floor overview",
                      menu: "Your menu",
                      categories: "Categories",
                      orders: "Order history",
                      printing: "Kitchen & bar",
                      analytics: "Analytics",
                      settings: "Restaurant settings",
                    } as any
                  )[page]}
            </h1>
          </div>
          <div className="top-actions">
            <span className={"connection " + (online ? "" : "offline")}>
              <Wifi size={15} />
              {desktop
                ? "Local hub"
                : connection.mode === "cloud"
                  ? "Cloud"
                  : "Restaurant Wi-Fi"}{" "}
              · {online ? "Connected" : "Unavailable"}
            </span>
            <span className="date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </header>
        {error && (
          <div role="alert" className="banner error">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="toast">
            <Check size={18} />
            {notice}
          </div>
        )}
        {unresolved && (
          <div className="banner warning">
            An action is awaiting confirmation. Retry uses the same ID to
            prevent duplicates.
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await submit(unresolved.type, unresolved.payload, unresolved);
                  await refresh();
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                  setUnresolved(pending());
                }
              }}
            >
              <RefreshCw size={16} />
              Retry pending action
            </button>
          </div>
        )}
        {!online && data && !desktop && (
          <div className="banner warning">
            Showing the last saved view. Reconnect to the desktop or cloud
            before changing orders.
          </div>
        )}
        {desktop && info?.update?.state === "ready" && (
          <div className="banner">
            Version {info.update.nextVersion} is downloaded. Restart after
            service to install it.
            <button onClick={() => ipc("installUpdate")}>Restart now</button>
          </div>
        )}
        {!s ? (
          <div className="empty">
            <Monitor size={40} />
            <h2>Connecting to your restaurant</h2>
            <p>The Windows app must be running to process orders.</p>
            {!desktop && (
              <button onClick={() => setSetup(true)}>
                Connection settings
              </button>
            )}
          </div>
        ) : (
          <div
            className={"content " + (busy ? "working" : "")}
            aria-busy={busy}
          >
            {page === "floor" && !order && (
              <>
                <div className="stats">
                  <div>
                    <span>Open tables</span>
                    <strong>
                      {open.length}
                      <small> / {tables.length}</small>
                    </strong>
                  </div>
                  <div>
                    <span>Current orders</span>
                    <strong>
                      {money(open.reduce((n, o) => n + due(o), 0))}
                    </strong>
                  </div>
                  <div>
                    <span>Available tables</span>
                    <strong>
                      {
                        tables.filter(
                          (t) => !open.some((o) => o.tableId === t.id),
                        ).length
                      }
                    </strong>
                  </div>
                  <div>
                    <span>Tickets to check</span>
                    <strong>
                      {
                        s.jobs.filter((j) =>
                          ["queued", "error", "uncertain"].includes(j.status),
                        ).length
                      }
                    </strong>
                  </div>
                </div>
                <div className="section-toolbar">
                  <div className="tabs">
                    {["All rooms", ...new Set(tables.map((t) => t.room))].map(
                      (r) => (
                        <button
                          key={r}
                          className={room === r ? "selected" : ""}
                          onClick={() => setRoom(r)}
                        >
                          {r}
                        </button>
                      ),
                    )}
                  </div>
                  {manager && (
                    <button className="primary" onClick={() => editTable()}>
                      <Plus size={18} />
                      Add table
                    </button>
                  )}
                </div>
                {!tables.length ? (
                  <div className="empty">
                    <LayoutGrid size={42} />
                    <h2>Your floor starts here</h2>
                    <p>
                      Add your tables and menu, or load the Angel Steakhouse
                      menu.
                    </p>
                    {manager && (
                      <div className="row">
                        <button className="primary" onClick={() => editTable()}>
                          Add first table
                        </button>
                        <button
                          onClick={() =>
                            act(
                              "demo.load",
                              {},
                              "Angel Steakhouse menu loaded",
                            )
                          }
                        >
                          Load Angel Steakhouse menu
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="floor-grid">
                    {tables
                      .filter((t) => room === "All rooms" || t.room === room)
                      .map((t) => {
                        const o = open.find((o) => o.tableId === t.id);
                        return (
                          <button
                            key={t.id}
                            className={"table-card " + (o ? "occupied" : "")}
                            disabled={busy || !online || !!unresolved}
                            onClick={() => chooseTable(t)}
                          >
                            <div className="table-top">
                              <span className={"pill " + (o ? "green" : "")}>
                                {o ? "In service" : "Available"}
                              </span>
                              <span>{t.seats} seats</span>
                            </div>
                            <div className="table-number">{t.name}</div>
                            <div className="table-bottom">
                              <span>
                                {o
                                  ? `${o.items.filter((i) => !i.voided).reduce((n, i) => n + i.qty, 0)} items`
                                  : t.room}
                              </span>
                              <strong>
                                {o ? money(due(o)) : <Plus size={21} />}
                              </strong>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
                <div className="floor-caption">
                  Tap a table to start or continue an order.
                </div>
              </>
            )}
            {page === "floor" && order && (
              <>
                <div className="section-toolbar">
                  <button
                    onClick={() => {
                      setSelected(null);
                      setSplit([]);
                      setShareBill(false);
                    }}
                  >
                    <ArrowLeft size={17} />
                    All tables
                  </button>
                  <div className="row">
                    <span className="muted">
                      Opened {date(order.createdAt)}
                    </span>
                    <button
                      onClick={() =>
                        setModal(
                          <Transfer
                            order={order}
                            tables={tables}
                            open={open}
                            split={split}
                            onClose={() => setModal(null)}
                            onSave={async (type, p) => {
                              if (
                                await act(type, {
                                  orderId: order.id,
                                  version: order.version,
                                  ...p,
                                })
                              ) {
                                setModal(null);
                                setSelected(null);
                                setSplit([]);
                              }
                            }}
                          />,
                        )
                      }
                    >
                      <ArrowRightLeft size={16} />
                      Move / split
                    </button>
                  </div>
                </div>
                <div className="pos-layout">
                  <section className="catalog">
                    <div className="search">
                      <Search size={18} />
                      <input
                        placeholder="Search the menu"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="tabs categories">
                      {["All", ...categoryNames].map(
                        (c) => (
                          <button
                            key={c}
                            className={category === c ? "selected" : ""}
                            onClick={() => setCategory(c)}
                          >
                            {c}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="menu-grid">
                      {menu
                        .filter(
                          (m) =>
                            m.available &&
                            (category === "All" || m.category === category) &&
                            m.name.toLowerCase().includes(query.toLowerCase()),
                        )
                        .map((m) => (
                          <button
                            key={m.id}
                            className="dish"
                            disabled={busy || !online || !!unresolved}
                            onClick={() =>
                              setModal(
                                <AddItem
                                  item={m}
                                  category={categories.find(
                                    (c) => c.name === m.category,
                                  )}
                                  money={money}
                                  onClose={() => setModal(null)}
                                  onSave={async (p) => {
                                    if (
                                      await act(
                                        "order.add",
                                        {
                                          orderId: order.id,
                                          version: order.version,
                                          menuId: m.id,
                                          ...p,
                                        },
                                        "Item added",
                                      )
                                    )
                                      setModal(null);
                                  }}
                                />,
                              )
                            }
                          >
                            {m.image && (
                              <img
                                className="dish-photo"
                                src={m.image}
                                alt=""
                              />
                            )}
                            <span className={"station " + m.station}>
                              {m.station === "kitchen" ? "KITCHEN" : "BAR"}
                            </span>
                            <strong>{m.name}</strong>
                            <div>
                              <span>{money(m.price)}</span>
                              <Plus size={19} />
                            </div>
                          </button>
                        ))}
                    </div>
                    {!menu.length && (
                      <div className="empty">
                        <p>Add dishes and drinks in Menu first.</p>
                        <button onClick={() => setPage("menu")}>
                          Go to menu
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="order-panel">
                    <header>
                      <h2>Current order</h2>
                      <span className="pill">
                        #{order.id.slice(0, 6).toUpperCase()}
                      </span>
                    </header>
                    <div className="order-items">
                      {!order.items.length && (
                        <div className="empty compact">
                          <ReceiptText size={30} />
                          <p>Choose items from the menu.</p>
                        </div>
                      )}
                      {order.items.map((i) => {
                        const paidCount = i.paidQty || 0;
                        const left = i.voided ? 0 : i.qty - paidCount;
                        return (
                          <React.Fragment key={i.id}>
                            {paidCount > 0 && (
                              <div className="order-line paid">
                                <span className="line-check-spacer" />
                                <span className="qty">{paidCount}</span>
                                <div className="line-name">
                                  <strong>{i.name}</strong>
                                  {choiceLines(i).map((line) => (
                                    <small key={line}>{line}</small>
                                  ))}
                                  {i.note && <small>{i.note}</small>}
                                  <small className="paid-label">Paid</small>
                                </div>
                                <strong>
                                  {money(unitAmount(i) * paidCount)}
                                </strong>
                              </div>
                            )}
                            {(i.voided || left > 0) && (
                              <div
                                className={
                                  "order-line " + (i.voided ? "voided" : "")
                                }
                              >
                                <input
                                  aria-label={`Select ${i.name} for split`}
                                  type="checkbox"
                                  checked={split.includes(i.id)}
                                  disabled={i.voided || paidCount > 0}
                                  onChange={(e) =>
                                    setSplit(
                                      e.target.checked
                                        ? [...split, i.id]
                                        : split.filter((x) => x !== i.id),
                                    )
                                  }
                                />
                                {i.voided || i.sent ? (
                                  <span className="qty">
                                    {i.voided ? i.qty : left}
                                  </span>
                                ) : (
                                  <span className="qty-stepper">
                                    <button
                                      className="icon"
                                      type="button"
                                      aria-label={`Fewer ${i.name}`}
                                      disabled={
                                        busy ||
                                        !online ||
                                        !!unresolved ||
                                        i.sent
                                      }
                                      onClick={() => {
                                        if (i.qty <= 1)
                                          act("order.remove", {
                                            orderId: order.id,
                                            version: order.version,
                                            itemId: i.id,
                                          });
                                        else
                                          act("order.qty", {
                                            orderId: order.id,
                                            version: order.version,
                                            itemId: i.id,
                                            qty: i.qty - 1,
                                          });
                                      }}
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="qty">{left}</span>
                                    <button
                                      className="icon"
                                      type="button"
                                      aria-label={`More ${i.name}`}
                                      disabled={
                                        busy ||
                                        !online ||
                                        !!unresolved ||
                                        (!i.sent && i.qty >= 99)
                                      }
                                      onClick={() => {
                                        if (i.sent)
                                          act(
                                            "order.add",
                                            {
                                              orderId: order.id,
                                              version: order.version,
                                              menuId: i.menuId,
                                              qty: 1,
                                              note: i.note || "",
                                              sideId: i.choices?.side?.id,
                                              cookId: i.choices?.cook?.id,
                                              extraIds: (
                                                i.choices?.extras || []
                                              ).map((extra) => extra.id),
                                              leaveoutIds: (
                                                i.choices?.leaveouts || []
                                              ).map((leave) => leave.id),
                                            },
                                            "Item added",
                                          );
                                        else
                                          act("order.qty", {
                                            orderId: order.id,
                                            version: order.version,
                                            itemId: i.id,
                                            qty: i.qty + 1,
                                          });
                                      }}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </span>
                                )}
                                <div className="line-name">
                                  <strong>{i.name}</strong>
                                  {choiceLines(i).map((line) => (
                                    <small key={line}>{line}</small>
                                  ))}
                                  {i.note && <small>{i.note}</small>}
                                  <small
                                    className={i.sent ? "muted" : "new-label"}
                                  >
                                    {i.voided
                                      ? "Cancelled"
                                      : i.sent
                                        ? "Sent"
                                        : "New"}
                                  </small>
                                </div>
                                <strong>
                                  {money(
                                    i.voided
                                      ? lineAmount(i)
                                      : unpaidAmount(i),
                                  )}
                                </strong>
                                {!i.voided && paidCount === 0 && (
                                  <button
                                    className="icon"
                                    aria-label={`Remove ${i.name}`}
                                    disabled={busy || (!manager && i.sent)}
                                    onClick={() => {
                                      if (i.sent) {
                                        setModal(
                                          <Confirm
                                            title="Cancel sent item"
                                            description="A cancellation ticket will be queued for the correct station."
                                            onClose={() => setModal(null)}
                                            onConfirm={async () => {
                                              if (
                                                await act("order.remove", {
                                                  orderId: order.id,
                                                  version: order.version,
                                                  itemId: i.id,
                                                })
                                              )
                                                setModal(null);
                                            }}
                                          />,
                                        );
                                      } else
                                        act("order.remove", {
                                          orderId: order.id,
                                          version: order.version,
                                          itemId: i.id,
                                        });
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div className="order-footer">
                      <div className="total">
                        <span>
                          {due(order) < sum(order) ? "Still to pay" : "Total"}
                        </span>
                        <strong>{money(due(order))}</strong>
                      </div>
                      {due(order) < sum(order) && (
                        <p className="muted bill-progress">
                          {money(sum(order) - due(order))} paid of{" "}
                          {money(sum(order))}
                        </p>
                      )}
                      <button
                        className="primary full"
                        disabled={
                          busy ||
                          !online ||
                          !!unresolved ||
                          !order.items.some((i) => !i.sent && !i.voided)
                        }
                        onClick={async () => {
                          if (
                            await act(
                              "order.send",
                              { orderId: order.id, version: order.version },
                              "Kitchen and bar tickets queued",
                            )
                          ) {
                            setSelected(null);
                            setSplit([]);
                            setShareBill(false);
                            setPage("floor");
                          }
                        }}
                      >
                        <Send size={18} />
                        Send new items
                      </button>
                      <button
                        className="full"
                        disabled={
                          busy ||
                          !online ||
                          !!unresolved ||
                          !order.items.some((i) => !i.voided)
                        }
                        onClick={() =>
                          setModal(
                            <PrintBill
                              order={order}
                              printers={printers}
                              money={money}
                              busy={busy}
                              onClose={() => setModal(null)}
                              onPrint={async (printerId) => {
                                if (
                                  await act(
                                    "order.printBill",
                                    {
                                      orderId: order.id,
                                      version: order.version,
                                      printerId,
                                    },
                                    "Bill sent to printer",
                                  )
                                )
                                  setModal(null);
                              }}
                            />,
                          )
                        }
                      >
                        <Printer size={18} />
                        Print bill
                      </button>
                      <button
                        className="full"
                        disabled={
                          busy ||
                          !online ||
                          !!unresolved ||
                          !order.items.some(
                            (i) => i.sent && unpaidQty(i) > 0,
                          )
                        }
                        onClick={() => setShareBill(true)}
                      >
                        <Users size={18} />
                        Share bill
                      </button>
                      <button
                        className="full"
                        disabled={busy || !online || !!unresolved}
                        onClick={() =>
                          setModal(
                            <CloseOrder
                              order={order}
                              money={money}
                              onClose={() => setModal(null)}
                              onSave={async (payment) => {
                                if (
                                  await act(
                                    "order.close",
                                    {
                                      orderId: order.id,
                                      version: order.version,
                                      payment,
                                    },
                                    "Order closed",
                                  )
                                ) {
                                  setModal(null);
                                  setShareBill(false);
                                  setSelected(null);
                                }
                              }}
                            />,
                          )
                        }
                      >
                        {due(order) < sum(order)
                          ? "Close remaining"
                          : "Close & record payment"}
                      </button>
                      {manager && (
                        <button
                          className="danger-text full"
                          onClick={() =>
                            setModal(
                              <Confirm
                                title="Cancel / delete order"
                                description="The order will be cancelled and will no longer appear in Orders. Sent items still queue a cancellation ticket."
                                onClose={() => setModal(null)}
                                onConfirm={async () => {
                                  if (
                                    await act("order.void", {
                                      orderId: order.id,
                                      version: order.version,
                                    })
                                  ) {
                                    setModal(null);
                                    setSelected(null);
                                  }
                                }}
                              />,
                            )
                          }
                        >
                          Cancel order
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
            {page === "menu" && (
              <>
                <div className="section-toolbar">
                  <div className="search">
                    <Search size={18} />
                    <input
                      placeholder="Search dishes and drinks"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        if (e.target.value.trim()) setCollapsedCats([]);
                      }}
                    />
                  </div>
                  <div className="row">
                    {!!menu.length && (
                      <button
                        onClick={() =>
                          setCollapsedCats(
                            collapsedCats.length
                              ? []
                              : categoryNames,
                          )
                        }
                      >
                        <ChevronsUpDown size={16} />
                        {collapsedCats.length ? "Expand all" : "Collapse all"}
                      </button>
                    )}
                    {manager && (
                      <button className="primary" onClick={() => editMenu()}>
                        <Plus size={18} />
                        Add menu item
                      </button>
                    )}
                  </div>
                </div>
                <div className="panel">
                  <div className="list-head">
                    <span>ITEM</span>
                    <span>PRICE</span>
                    <span>STATION</span>
                    <span>AVAILABILITY</span>
                  </div>
                  {categoryNames
                    .map((name) => ({
                      name,
                      items: menu.filter(
                        (m) =>
                          m.category === name &&
                          m.name
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      ),
                    }))
                    .filter((group) => group.items.length || !query.trim())
                    .map((group) => {
                      const open = !collapsedCats.includes(group.name);
                      return (
                        <section className="menu-group" key={group.name}>
                          <button
                            type="button"
                            className={
                              "menu-group-head" + (open ? " open" : "")
                            }
                            aria-expanded={open}
                            onClick={() =>
                              setCollapsedCats((prev) =>
                                prev.includes(group.name)
                                  ? prev.filter((n) => n !== group.name)
                                  : [...prev, group.name],
                              )
                            }
                          >
                            <ChevronRight
                              className="menu-group-chevron"
                              size={18}
                            />
                            <strong>{group.name}</strong>
                            <small>
                              {group.items.length}{" "}
                              {group.items.length === 1 ? "item" : "items"}
                            </small>
                          </button>
                          {open &&
                            group.items.map((m) => (
                              <div className="list-row" key={m.id}>
                                <div className="item-cell">
                                  {m.image ? (
                                    <img
                                      className="thumb"
                                      src={m.image}
                                      alt=""
                                    />
                                  ) : (
                                    <span className="thumb empty-thumb" />
                                  )}
                                  <div>
                                    <strong>{m.name}</strong>
                                  </div>
                                </div>
                                <strong>{money(m.price)}</strong>
                                <span className={"station " + m.station}>
                                  {m.station}
                                </span>
                                <div className="row">
                                  <span>
                                    {m.available ? "Available" : "Hidden"}
                                  </span>
                                  {manager && (
                                    <>
                                      <button onClick={() => editMenu(m)}>
                                        Edit
                                      </button>
                                      <button
                                        className="icon danger-text"
                                        aria-label={`Delete ${m.name}`}
                                        onClick={() =>
                                          confirmAction(
                                            "Delete menu item",
                                            `${m.name} will leave the menu. Existing orders keep their item details.`,
                                            () =>
                                              act("menu.delete", { id: m.id }),
                                          )
                                        }
                                      >
                                        <Trash2 size={17} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                        </section>
                      );
                    })}
                  {!menu.length && (
                    <div className="empty">
                      <UtensilsCrossed size={36} />
                      <h2>Add your first menu item</h2>
                      <p>Choose a kitchen or bar destination for each item.</p>
                    </div>
                  )}
                  {!!menu.length &&
                    !menu.some((m) =>
                      m.name.toLowerCase().includes(query.toLowerCase()),
                    ) && (
                      <div className="empty">
                        <Search size={36} />
                        <h2>No matching items</h2>
                        <p>Try a different name or clear the search.</p>
                      </div>
                    )}
                </div>
              </>
            )}
            {page === "categories" && (
              <>
                <div className="section-toolbar">
                  <p className="muted">
                    Categories appear as tabs on the floor and in the menu item
                    dropdown.
                  </p>
                  {manager && (
                    <button className="primary" onClick={() => editCategory()}>
                      <Plus size={18} />
                      Add category
                    </button>
                  )}
                </div>
                <div className="panel padded">
                  {categories.map((c) => {
                    const count = menu.filter((m) => m.category === c.name)
                      .length;
                    return (
                      <div className="settings-row" key={c.id}>
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {count} {count === 1 ? "item" : "items"}
                            {c.sideMode === "free"
                              ? " · included side"
                              : c.sideMode === "paid"
                                ? " · priced side"
                                : c.sideMode === "mixed"
                                  ? " · free or paid side"
                                  : ""}
                          </small>
                        </div>
                        {manager && (
                          <div className="row">
                            <button onClick={() => editCategory(c)}>
                              Edit
                            </button>
                            <button
                              className="icon danger-text"
                              aria-label={`Delete ${c.name}`}
                              onClick={() =>
                                confirmAction(
                                  "Delete category",
                                  "The category must have no menu items.",
                                  () => act("category.delete", { id: c.id }),
                                )
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!categories.length && (
                    <div className="empty">
                      <Tags size={36} />
                      <h2>Add your first category</h2>
                      <p>
                        Create groups such as Starters, Mains or Drinks, then
                        assign them when you add menu items.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            {page === "orders" && (
              <>
                <div className="stats">
                  <div>
                    <span>Paid today</span>
                    <strong>
                      {money(
                        history
                          .filter(
                            (o) =>
                              o.status === "paid" &&
                              new Date(o.closedAt!).toDateString() ===
                                new Date().toDateString(),
                          )
                          .reduce((n, o) => n + (o.paidTotal || 0), 0),
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Open orders</span>
                    <strong>{open.length}</strong>
                  </div>
                </div>
                <div className="panel">
                  <div className="section-toolbar">
                    <h2>All orders</h2>
                    <span className="muted">Newest first</span>
                  </div>
                  {[...history].reverse().map((o) => (
                    <button
                      className="history-row"
                      key={o.id}
                      onClick={() => {
                        if (o.status === "open") {
                          setSelected(o.id);
                          setPage("floor");
                        } else
                          setModal(
                            <Modal
                              title={`${o.tableName} · ${o.status}`}
                              onClose={() => setModal(null)}
                            >
                              <p className="muted">
                                {date(o.createdAt)} · {o.openedBy}
                              </p>
                              {o.items.map((i) => {
                                const paidCount = i.paidQty || 0;
                                const left = i.voided
                                  ? 0
                                  : i.qty - paidCount;
                                return (
                                  <React.Fragment key={i.id}>
                                    {paidCount > 0 && (
                                      <div className="review-line paid">
                                        <span>
                                          {paidCount} × {i.name}
                                          <small>Paid</small>
                                          {choiceLines(i).map((line) => (
                                            <small key={line}>{line}</small>
                                          ))}
                                        </span>
                                        <strong>
                                          {money(unitAmount(i) * paidCount)}
                                        </strong>
                                      </div>
                                    )}
                                    {(i.voided || left > 0) && (
                                      <div className="review-line">
                                        <span>
                                          {i.voided ? i.qty : left} × {i.name}
                                          {i.voided ? " (cancelled)" : ""}
                                          {choiceLines(i).map((line) => (
                                            <small key={line}>{line}</small>
                                          ))}
                                        </span>
                                        <strong>
                                          {money(
                                            i.voided
                                              ? lineAmount(i)
                                              : unpaidAmount(i),
                                          )}
                                        </strong>
                                      </div>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                              {(o.payments || []).map((p) => (
                                <p className="muted" key={p.id}>
                                  {p.payment} · {money(p.amount)}
                                </p>
                              ))}
                              <p>{o.reason}</p>
                              <div className="total">
                                <span>{o.payment || o.status}</span>
                                <strong>{money(o.paidTotal ?? sum(o))}</strong>
                              </div>
                            </Modal>,
                          );
                      }}
                    >
                      <div>
                        <strong>{o.tableName}</strong>
                        <small>
                          {date(o.createdAt)} · #{o.id.slice(0, 6)}
                        </small>
                      </div>
                      <span
                        className={
                          "pill " + (o.status === "open" ? "green" : "")
                        }
                      >
                        {o.status}
                      </span>
                      <strong>{money(o.paidTotal ?? sum(o))}</strong>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                  {!history.length && (
                    <div className="empty">
                      <History size={36} />
                      <p>Orders will appear here as service starts.</p>
                    </div>
                  )}
                </div>
              </>
            )}
            {page === "printing" && (
              <>
                <div className="banner neutral">
                  Tickets marked “spooled” were accepted by the printer driver.
                  Check the paper before retrying a failed or uncertain ticket.
                </div>
                <div className="stations">
                  {(["kitchen", "bar", "bill"] as const).map((station) => (
                    <section className="panel" key={station}>
                      <div className="section-toolbar">
                        <h2 className="capitalize">{station}</h2>
                        <span className="pill">
                          {
                            s.jobs.filter(
                              (j) =>
                                j.station === station && j.status === "queued",
                            ).length
                          }{" "}
                          queued
                        </span>
                      </div>
                      {[...s.jobs]
                        .reverse()
                        .filter((j) => j.station === station)
                        .map((j) => (
                          <article className="ticket-card" key={j.id}>
                            <div className="row between">
                              <strong>{j.tableName}</strong>
                              <span
                                className={
                                  "pill " +
                                  (["error", "uncertain"].includes(j.status)
                                    ? "red"
                                    : "")
                                }
                              >
                                {j.status}
                              </span>
                            </div>
                            <small>
                              {j.kind} · {date(j.createdAt)}
                            </small>
                            {j.items.map((i, n) => (
                              <p key={n}>
                                {i.qty} × {i.name}
                                {choiceLines(i).map((line) => (
                                  <small key={line}>{line}</small>
                                ))}
                                {i.note && <small>{i.note}</small>}
                              </p>
                            ))}
                            {j.error && (
                              <p className="danger-text">{j.error}</p>
                            )}
                            {manager &&
                              !["queued", "printing"].includes(j.status) && (
                                <button
                                  onClick={() =>
                                    confirmAction(
                                      "Reprint ticket",
                                      "Check whether the original printed. A new ticket labelled REPRINT will be queued.",
                                      () => act("job.retry", { id: j.id }),
                                    )
                                  }
                                >
                                  <Printer size={15} />
                                  Reprint
                                </button>
                              )}
                            {manager &&
                              ["error", "uncertain"].includes(j.status) && (
                                <button
                                  onClick={() =>
                                    setModal(
                                      <Confirm
                                        title="Resolve ticket"
                                        description="Record what happened, for example: printed successfully, or handled manually."
                                        reason
                                        onClose={() => setModal(null)}
                                        onConfirm={async (reason) => {
                                          if (
                                            await act("job.resolve", {
                                              id: j.id,
                                              reason,
                                            })
                                          )
                                            setModal(null);
                                        }}
                                      />,
                                    )
                                  }
                                >
                                  Mark resolved
                                </button>
                              )}
                          </article>
                        ))}
                      {!s.jobs.some((j) => j.station === station) && (
                        <div className="empty compact">
                          <Printer size={30} />
                          <p>No tickets yet</p>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
            {page === "analytics" && manager && (
              <Analytics
                orders={history.filter((o) => o.status === "paid")}
                money={money}
              />
            )}
            {page === "settings" && manager && !settingsUnlocked && (
              <PinGate
                hasPin={!!s.settings.managerPinHash}
                onUnlock={async (pin) => {
                  if (!s.settings.managerPinHash) {
                    if (
                      await act(
                        "settings.save",
                        { settings: s.settings, pin },
                        "PIN set",
                      )
                    )
                      setSettingsUnlocked(true);
                    return;
                  }
                  if ((await pinHash(pin)) !== s.settings.managerPinHash) {
                    setError("Incorrect PIN");
                    return;
                  }
                  setSettingsUnlocked(true);
                }}
              />
            )}
            {page === "settings" && manager && settingsUnlocked && (
              <div className="settings-grid">
                {manager && (
                  <>
                    <SettingsForm
                      settings={s.settings}
                      onSave={(p, pin) =>
                        act("settings.save", { settings: p, pin })
                      }
                    />
                    <section className="panel padded">
                      <h2>Load menu</h2>
                      <p>
                        Replace categories and dishes with the Angel Steakhouse
                        menu. Close open orders first. Past tickets keep their
                        original lines.
                      </p>
                      <button
                        onClick={() =>
                          confirmAction(
                            "Replace the menu",
                            "Current categories and dishes will be replaced with the printed Angel Steakhouse menu, including included sides, Angel sides and extras.",
                            () =>
                              act(
                                "menu.replace",
                                {},
                                "Angel Steakhouse menu loaded",
                              ),
                          )
                        }
                      >
                        Load Angel Steakhouse menu
                      </button>
                    </section>
                    <section className="panel padded">
                      <h2>Tables & rooms</h2>
                      {tables.map((t) => (
                        <div className="settings-row" key={t.id}>
                          <div>
                            <strong>{t.name}</strong>
                            <small>
                              {t.room} · {t.seats} seats
                            </small>
                          </div>
                          <div className="row">
                            <button onClick={() => editTable(t)}>Edit</button>
                            <button
                              className="icon danger-text"
                              aria-label={`Delete ${t.name}`}
                              onClick={() =>
                                confirmAction(
                                  "Delete table",
                                  "The table must have no open orders. Its past orders will no longer appear in Orders.",
                                  () => act("table.delete", { id: t.id }),
                                )
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => editTable()}>
                        <Plus size={16} />
                        Add table
                      </button>
                    </section>
                  </>
                )}
                {desktop ? (
                  <>
                    <DesktopSettings
                      info={info}
                      setInfo={setInfo}
                      onError={setError}
                    />
                    <section className="panel padded">
                      <h2>Backup & audit</h2>
                      <p>
                        Create a full SQLite backup including order history and
                        paired devices.
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            const p = await ipc("backup");
                            if (p) setNotice("Backup saved");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <Download size={17} />
                        Save backup
                      </button>
                      <div className="audit">
                        {[...s.audit]
                          .reverse()
                          .slice(0, 30)
                          .map((a) => (
                            <div key={a.id}>
                              <strong>{a.action}</strong>
                              <small>
                                {date(a.at)} · {a.actor}
                              </small>
                            </div>
                          ))}
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="panel padded">
                    <h2>Device connection</h2>
                    <p>
                      {connection.mode === "lan"
                        ? "Connected through the Windows hub"
                        : "Connected through Supabase"}
                    </p>
                    <button onClick={() => setSetup(true)}>
                      <Smartphone size={18} />
                      Change connection / sign in
                    </button>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      {modal}
      {shareBill && order && (
        <ShareBill
          order={order}
          money={money}
          busy={busy}
          onClose={() => setShareBill(false)}
          onSave={async (payment, items) => {
            const r = await act(
              "order.payShare",
              {
                orderId: order.id,
                version: order.version,
                payment,
                items,
              },
              "Share recorded",
            );
            if (r?.closed) {
              setNotice("Order closed");
              setShareBill(false);
              setSelected(null);
            }
            return r;
          }}
        />
      )}
    </div>
  );
}
function Confirm({
  title,
  description,
  reason = false,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  reason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onConfirm(value);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{description}</p>
        {reason && (
          <label>
            Reason
            <textarea
              required
              maxLength={300}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </label>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Back
          </button>
          <button className="primary" disabled={busy}>
            Confirm
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function TableForm({
  table,
  onClose,
  onSave,
}: {
  table?: Table;
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const [p, setP] = useState(
    table || { name: "", room: "Main room", seats: 4 },
  );
  return (
    <Modal title={table ? "Edit table" : "Add table"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(p);
        }}
      >
        <label>
          Table name
          <input
            autoFocus
            required
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label>
          Room
          <input
            required
            value={p.room}
            onChange={(e) => setP({ ...p, room: e.target.value })}
          />
        </label>
        <label>
          Seats
          <input
            type="number"
            min="1"
            max="50"
            required
            value={p.seats}
            onChange={(e) => setP({ ...p, seats: Number(e.target.value) })}
          />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save table</button>
        </footer>
      </form>
    </Modal>
  );
}
function newRow(name = "", price = 0): Side {
  return { id: crypto.randomUUID(), name, price, deleted: false };
}
function OptionEditor({
  title,
  hint,
  rows,
  showPrice,
  onChange,
}: {
  title: string;
  hint?: string;
  rows: Side[];
  showPrice?: boolean;
  onChange: (rows: Side[]) => void;
}) {
  return (
    <fieldset className="option-list">
      <legend>{title}</legend>
      {hint && <p className="muted">{hint}</p>}
      {rows.map((row, index) => (
        <div className={"option-row" + (showPrice ? " priced" : "")} key={row.id}>
          <input
            required
            placeholder="Name"
            value={row.name}
            onChange={(e) =>
              onChange(
                rows.map((r, i) =>
                  i === index ? { ...r, name: e.target.value } : r,
                ),
              )
            }
          />
          {showPrice && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={(row.price / 100).toFixed(2)}
              onChange={(e) =>
                onChange(
                  rows.map((r, i) =>
                    i === index
                      ? {
                          ...r,
                          price: Math.round(Number(e.target.value) * 100) || 0,
                        }
                      : r,
                  ),
                )
              }
            />
          )}
          <button
            type="button"
            className="icon danger-text"
            aria-label={`Remove ${row.name || title}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, newRow()])}
      >
        <Plus size={15} />
        Add
      </button>
    </fieldset>
  );
}
function AddonGroupEditor({
  groups,
  onChange,
}: {
  groups: AddonGroup[];
  onChange: (groups: AddonGroup[]) => void;
}) {
  return (
    <div className="addon-groups">
      <div className="addon-groups-head">
        <strong>Add-on groups</strong>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...groups,
              {
                id: crypto.randomUUID(),
                name: "",
                deleted: false,
                extras: [],
              },
            ])
          }
        >
          <Plus size={15} />
          Add group
        </button>
      </div>
      <p className="muted">
        Group extras such as sauces or toppings. Guests can pick any from each
        group.
      </p>
      {groups.map((group, index) => (
        <fieldset className="option-list addon-group" key={group.id}>
          <div className="option-row">
            <input
              required
              placeholder="Group name, e.g. Sauces"
              value={group.name}
              onChange={(e) =>
                onChange(
                  groups.map((g, i) =>
                    i === index ? { ...g, name: e.target.value } : g,
                  ),
                )
              }
            />
            <button
              type="button"
              className="icon danger-text"
              aria-label={`Remove ${group.name || "group"}`}
              onClick={() => onChange(groups.filter((_, i) => i !== index))}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <OptionEditor
            title="Choices"
            rows={group.extras}
            showPrice
            onChange={(extras) =>
              onChange(
                groups.map((g, i) => (i === index ? { ...g, extras } : g)),
              )
            }
          />
        </fieldset>
      ))}
    </div>
  );
}
function CategoryForm({
  category,
  onClose,
  onSave,
}: {
  category?: Category;
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name || "");
  const [sideMode, setSideMode] = useState(category?.sideMode || "none");
  const [sides, setSides] = useState(
    (category?.sides || []).filter((side) => !side.deleted),
  );
  return (
    <Modal
      title={category ? "Edit category" : "Add category"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: category?.id,
            name,
            sideMode,
            sides: sides.map((side) => ({
              ...side,
              price: sideMode === "free" ? 0 : side.price,
              deleted: false,
            })),
          });
        }}
      >
        <label>
          Category name
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Starters"
          />
        </label>
        <label>
          Side with each dish
          <select
            value={sideMode}
            onChange={(e) => setSideMode(e.target.value as Category["sideMode"])}
          >
            <option value="none">No side</option>
            <option value="free">Required, all included</option>
            <option value="paid">Required, all priced</option>
            <option value="mixed">Required, free or paid</option>
          </select>
        </label>
        {sideMode !== "none" && (
          <OptionEditor
            title="Sides"
            hint={
              sideMode === "mixed"
                ? "Guests pick one. Use 0.00 for an included side."
                : "Guests must pick one when ordering from this category."
            }
            rows={sides}
            showPrice={sideMode === "paid" || sideMode === "mixed"}
            onChange={setSides}
          />
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save category</button>
        </footer>
      </form>
    </Modal>
  );
}
function MenuForm({
  item,
  categories,
  onClose,
  onSave,
}: {
  item?: MenuItem;
  categories: string[];
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const options =
    item?.category && !categories.includes(item.category)
      ? [item.category, ...categories]
      : categories;
  const [p, setP] = useState(
    item || {
      name: "",
      category: options[0] || "",
      price: 0,
      station: "kitchen" as Station,
      available: true,
      image: "",
      modifiers: [] as Modifier[],
      addonGroups: [] as AddonGroup[],
      cookOptions: [] as CookOption[],
      sideMode: "inherit" as MenuItem["sideMode"],
    },
  );
  const [price, setPrice] = useState(((item?.price || 0) / 100).toFixed(2));
  const [photoError, setPhotoError] = useState("");
  const [groups, setGroups] = useState(() => addonGroupsOf(item));
  const leaveouts = (p.modifiers || []).filter(
    (m) => !m.deleted && m.kind === "leaveout",
  );
  function setLeaveouts(rows: Side[]) {
    const kept = (p.modifiers || []).filter(
      (m) => m.deleted || m.kind !== "leaveout",
    );
    setP({
      ...p,
      modifiers: [
        ...kept,
        ...rows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: "leaveout" as const,
          price: 0,
          deleted: false,
        })),
      ],
    });
  }
  return (
    <Modal title={item ? "Edit menu item" : "Add menu item"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...p,
            price: Math.round(Number(price) * 100),
            addonGroups: groups,
            modifiers: (p.modifiers || []).filter((m) => m.kind !== "extra"),
          });
        }}
      >
        <label>
          Item name
          <input
            autoFocus
            required
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Category
            <select
              required
              value={p.category}
              onChange={(e) => setP({ ...p, category: e.target.value })}
            >
              {!options.length && (
                <option value="" disabled>
                  Add a category first
                </option>
              )}
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>
        <label>
          Print destination
          <select
            value={p.station}
            onChange={(e) => setP({ ...p, station: e.target.value as Station })}
          >
            <option value="kitchen">Kitchen</option>
            <option value="bar">Bar</option>
          </select>
        </label>
        <label>
          Sides
          <select
            value={p.sideMode || "inherit"}
            onChange={(e) =>
              setP({ ...p, sideMode: e.target.value as MenuItem["sideMode"] })
            }
          >
            <option value="inherit">Same as category</option>
            <option value="none">No side</option>
            <option value="mixed">Free or paid side</option>
            <option value="free">Included side</option>
            <option value="paid">Priced side</option>
          </select>
        </label>
        <label>
          Photo
          <span className="photo-picker">
            {p.image ? (
              <img className="photo-preview" src={p.image} alt="" />
            ) : (
              <span className="photo-preview empty-thumb">
                <ImagePlus size={22} />
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setPhotoError("");
                  setP({ ...p, image: await resizePhoto(file) });
                } catch (err) {
                  setPhotoError((err as Error).message);
                }
              }}
            />
            {p.image && (
              <button
                type="button"
                onClick={() => setP({ ...p, image: "" })}
              >
                Remove photo
              </button>
            )}
          </span>
        </label>
        {photoError && <p className="danger-text">{photoError}</p>}
        <OptionEditor
          title="How it's cooked"
          hint="Required when ordering. Steaks typically use doneness."
          rows={(p.cookOptions || [])
            .filter((c) => !c.deleted)
            .map((c) => ({ ...c, price: 0 }))}
          onChange={(rows) =>
            setP({
              ...p,
              cookOptions: rows.map((row) => ({
                id: row.id,
                name: row.name,
                deleted: false,
              })),
            })
          }
        />
        {!(p.cookOptions || []).some((c) => !c.deleted) && (
          <button
            type="button"
            onClick={() =>
              setP({
                ...p,
                cookOptions: STEAK_COOKS.map((name) => ({
                  id: crypto.randomUUID(),
                  name,
                  deleted: false,
                })),
              })
            }
          >
            Use steak temperatures
          </button>
        )}
        <OptionEditor
          title="Leave out"
          hint="Free omissions, for example no onion."
          rows={leaveouts}
          onChange={setLeaveouts}
        />
        <AddonGroupEditor groups={groups} onChange={setGroups} />
        <label className="check-label">
          <input
            type="checkbox"
            checked={p.available}
            onChange={(e) => setP({ ...p, available: e.target.checked })}
          />
          Available to order
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save item</button>
        </footer>
      </form>
    </Modal>
  );
}
function AddItem({
  item,
  category,
  money,
  onClose,
  onSave,
}: {
  item: MenuItem;
  category?: Category;
  money: (v: number) => string;
  onClose: () => void;
  onSave: (p: any) => Promise<void>;
}) {
  const sides = (category?.sides || []).filter((side) => !side.deleted);
  const sideMode = ["none", "free", "paid", "mixed"].includes(item.sideMode || "")
    ? item.sideMode
    : category?.sideMode || "none";
  const needsSide = !!(sideMode && sideMode !== "none" && sides.length);
  const groups = addonGroupsOf(item).filter((group) =>
    group.extras.some((extra) => !extra.deleted),
  );
  const extras = groups.flatMap((group) => group.extras);
  const leaveouts = (item.modifiers || []).filter(
    (m) => !m.deleted && m.kind === "leaveout",
  );
  const cooks = (item.cookOptions || []).filter((c) => !c.deleted);
  const needsCook = cooks.length > 0;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [cookId, setCookId] = useState(cooks.length === 1 ? cooks[0].id : "");
  const [sideId, setSideId] = useState(sides.length === 1 ? sides[0].id : "");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [leaveoutIds, setLeaveoutIds] = useState<string[]>([]);
  const side = sides.find((s) => s.id === sideId);
  const extraTotal = extras
    .filter((m) => extraIds.includes(m.id))
    .reduce((n, m) => n + m.price, 0);
  const sidePrice = sideMode === "free" ? 0 : side?.price || 0;
  const unit = item.price + sidePrice + extraTotal;
  const includedSides = sides.filter((s) => !s.price);
  const paidSides = sides.filter((s) => s.price);
  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }
  return (
    <Modal title={item.name} onClose={onClose} wide>
      <form
        className="customize"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ qty, note, cookId, sideId, extraIds, leaveoutIds });
        }}
      >
        <div className="customize-top">
          <div>
            <p className="customize-price">{money(item.price)}</p>
            <small className={"station " + item.station}>
              {item.station === "kitchen" ? "Kitchen" : "Bar"}
            </small>
          </div>
          <div className="qty-picker" role="group" aria-label="Quantity">
            <button
              type="button"
              className="icon"
              aria-label="Fewer"
              disabled={qty <= 1}
              onClick={() => setQty(qty - 1)}
            >
              <Minus size={18} />
            </button>
            <strong>{qty}</strong>
            <button
              type="button"
              className="icon"
              aria-label="More"
              disabled={qty >= 99}
              onClick={() => setQty(qty + 1)}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        {item.image && (
          <img className="customize-photo" src={item.image} alt="" />
        )}
        {needsCook && (
          <section className="choice-section">
            <header>
              <h3>How it's cooked</h3>
              <span>Pick one</span>
            </header>
            <div className="choice-grid">
              {cooks.map((c) => (
                <ChoiceTile
                  key={c.id}
                  name={c.name}
                  selected={cookId === c.id}
                  onSelect={() => setCookId(c.id)}
                />
              ))}
            </div>
          </section>
        )}
        {needsSide && (
          <section className="choice-section">
            <header>
              <h3>Side</h3>
              <span>Pick one</span>
            </header>
            {sideMode === "mixed" && includedSides.length > 0 && (
              <p className="choice-sub">Included</p>
            )}
            <div className="choice-grid">
              {(sideMode === "mixed" ? includedSides : sides).map((s) => (
                <ChoiceTile
                  key={s.id}
                  name={s.name}
                  detail={
                    sideMode === "free"
                      ? undefined
                      : s.price
                        ? money(s.price)
                        : "Included"
                  }
                  selected={sideId === s.id}
                  onSelect={() => setSideId(s.id)}
                />
              ))}
            </div>
            {sideMode === "mixed" && paidSides.length > 0 && (
              <>
                <p className="choice-sub">Angel sides</p>
                <div className="choice-grid">
                  {paidSides.map((s) => (
                    <ChoiceTile
                      key={s.id}
                      name={s.name}
                      detail={money(s.price)}
                      selected={sideId === s.id}
                      paid
                      onSelect={() => setSideId(s.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {leaveouts.length > 0 && (
          <section className="choice-section">
            <header>
              <h3>Leave out</h3>
              <span>Optional</span>
            </header>
            <div className="choice-grid compact">
              {leaveouts.map((m) => (
                <ChoiceTile
                  key={m.id}
                  name={`No ${m.name}`}
                  selected={leaveoutIds.includes(m.id)}
                  tone="omit"
                  onSelect={() => toggle(leaveoutIds, m.id, setLeaveoutIds)}
                />
              ))}
            </div>
          </section>
        )}
        {groups.map((group) => (
          <section className="choice-section" key={group.id}>
            <header>
              <h3>{group.name}</h3>
              <span>Optional</span>
            </header>
            <div className="choice-grid">
              {group.extras.map((m) => (
                <ChoiceTile
                  key={m.id}
                  name={m.name}
                  detail={m.price ? money(m.price) : "Free"}
                  selected={extraIds.includes(m.id)}
                  paid={!!m.price}
                  onSelect={() => toggle(extraIds, m.id, setExtraIds)}
                />
              ))}
            </div>
          </section>
        ))}
        <label className="customize-notes">
          Preparation notes
          <textarea
            placeholder="Anything else for the kitchen or bar"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <footer className="customize-foot">
          <div>
            <small>Line total</small>
            <strong>{money(unit * qty)}</strong>
          </div>
          <button
            className="primary"
            disabled={(needsSide && !sideId) || (needsCook && !cookId)}
          >
            <Plus size={17} />
            Add to order
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function ChoiceTile({
  name,
  detail,
  selected,
  paid,
  tone,
  onSelect,
}: {
  name: string;
  detail?: string;
  selected: boolean;
  paid?: boolean;
  tone?: "omit";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={
        "choice-tile" +
        (selected ? " selected" : "") +
        (paid ? " paid" : "") +
        (tone === "omit" ? " omit" : "")
      }
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span>
        <strong>{name}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <span className="choice-mark">{selected ? <Check size={16} /> : ""}</span>
    </button>
  );
}
function PrintBill({
  order,
  printers,
  money,
  busy,
  onClose,
  onPrint,
}: {
  order: Order;
  printers: PrinterAssignments;
  money: (v: number) => string;
  busy: boolean;
  onClose: () => void;
  onPrint: (printerId: string) => Promise<void>;
}) {
  const [printerId, setPrinterId] = useState(
    printers.bill || printers.named[0]?.id || "",
  );
  return (
    <Modal title="Print bill" onClose={onClose}>
      <div className="total">
        <span>{due(order) < sum(order) ? "Still to pay" : "Total"}</span>
        <strong>{money(due(order))}</strong>
      </div>
      {printers.named.length > 1 ? (
        <label>
          Printer
          <select
            value={printerId}
            onChange={(e) => setPrinterId(e.target.value)}
          >
            {printers.named.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : printers.named.length === 1 ? (
        <p>This will print on {printers.named[0].name}.</p>
      ) : (
        <p>
          This uses the bill printer chosen on the Windows computer. Name
          printers there if you want to pick upstairs or downstairs from the
          phone.
        </p>
      )}
      <footer>
        <button onClick={onClose}>Back</button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => onPrint(printerId)}
        >
          Print bill
        </button>
      </footer>
    </Modal>
  );
}
function CloseOrder({
  order,
  money,
  onClose,
  onSave,
}: {
  order: Order;
  money: (v: number) => string;
  onClose: () => void;
  onSave: (p: string) => Promise<void>;
}) {
  const [payment, setPayment] = useState("cash");
  const remaining = due(order);
  const collected = sum(order) - remaining;
  return (
    <Modal title="Close order" onClose={onClose}>
      {collected > 0 && (
        <div className="total">
          <span>Already paid</span>
          <strong>{money(collected)}</strong>
        </div>
      )}
      <div className="total">
        <span>{collected > 0 ? "Still to pay" : order.tableName}</span>
        <strong>{money(remaining)}</strong>
      </div>
      <p>
        This records a payment already taken. It does not charge a card.
        {collected > 0
          ? " Only the remaining items will be marked paid."
          : ""}
      </p>
      {remaining > 0 && (
        <label>
          Payment method
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </label>
      )}
      <footer>
        <button onClick={onClose}>Back</button>
        <button className="primary" onClick={() => onSave(payment)}>
          {remaining > 0 ? "Record payment & close" : "Close table"}
        </button>
      </footer>
    </Modal>
  );
}
function ShareBill({
  order,
  money,
  busy,
  onClose,
  onSave,
}: {
  order: Order;
  money: (v: number) => string;
  busy: boolean;
  onClose: () => void;
  onSave: (
    payment: string,
    items: { itemId: string; qty: number }[],
  ) => Promise<any>;
}) {
  const [payment, setPayment] = useState("cash");
  const [picks, setPicks] = useState<Record<string, number>>({});
  useEffect(() => {
    setPicks({});
  }, [order.version]);
  const unpaid = order.items.filter((i) => unpaidQty(i) > 0);
  const paid = order.items.filter((i) => !i.voided && (i.paidQty || 0) > 0);
  const shareItems = Object.entries(picks)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => ({ itemId, qty }));
  const shareTotal = shareItems.reduce((n, s) => {
    const i = order.items.find((x) => x.id === s.itemId);
    return n + (i ? unitAmount(i) * s.qty : 0);
  }, 0);
  const remainingAfter = due(order) - shareTotal;
  const closesTable = unpaid.every(
    (i) => i.sent && (picks[i.id] || 0) === unpaidQty(i),
  );
  function setQty(id: string, qty: number, max: number) {
    setPicks((current) => {
      const next = { ...current };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(max, qty);
      return next;
    });
  }
  return (
    <Modal title="Share bill" onClose={onClose} wide>
      <p>
        Select what this person had. Their total updates as you tap. After you
        record the payment, those items are crossed off the bill.
      </p>
      {paid.length > 0 && <h3 className="share-heading">Already paid</h3>}
      {paid.map((i) => (
        <div className="share-line paid" key={i.id + "-paid"}>
          <span className="qty">{i.paidQty}</span>
          <div className="line-name">
            <strong>{i.name}</strong>
            {choiceLines(i).map((line) => (
              <small key={line}>{line}</small>
            ))}
            <small className="paid-label">Paid</small>
          </div>
          <strong>{money(unitAmount(i) * (i.paidQty || 0))}</strong>
        </div>
      ))}
      {unpaid.length > 0 && <h3 className="share-heading">Still to pay</h3>}
      {unpaid.map((i) => {
        const left = unpaidQty(i);
        const selected = picks[i.id] || 0;
        const canPay = i.sent;
        return (
          <div
            className={"share-line" + (selected ? " selected" : "")}
            key={i.id}
            onClick={() => {
              if (!canPay) return;
              setQty(i.id, selected > 0 ? 0 : left, left);
            }}
          >
            <input
              aria-label={`Add ${i.name} to this share`}
              type="checkbox"
              checked={selected > 0}
              disabled={!canPay}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                setQty(i.id, e.target.checked ? left : 0, left)
              }
            />
            <div className="line-name">
              <strong>{i.name}</strong>
              {choiceLines(i).map((line) => (
                <small key={line}>{line}</small>
              ))}
              {i.note && <small>{i.note}</small>}
              <small className={canPay ? "muted" : "new-label"}>
                {canPay
                  ? left > 1
                    ? `${left} still to pay`
                    : "Still to pay"
                  : "Send this item before taking payment"}
              </small>
            </div>
            {selected > 0 && left > 1 && (
              <span
                className="qty-picker compact"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="icon"
                  type="button"
                  aria-label={`Fewer ${i.name}`}
                  onClick={() => setQty(i.id, selected - 1, left)}
                >
                  <Minus size={14} />
                </button>
                <strong>{selected}</strong>
                <button
                  className="icon"
                  type="button"
                  aria-label={`More ${i.name}`}
                  disabled={selected >= left}
                  onClick={() => setQty(i.id, selected + 1, left)}
                >
                  <Plus size={14} />
                </button>
              </span>
            )}
            <strong>
              {money(unitAmount(i) * (selected || left))}
            </strong>
          </div>
        );
      })}
      {!unpaid.length && (
        <p className="muted">Everything on this bill is already paid.</p>
      )}
      <div className="total">
        <span>This person</span>
        <strong>{money(shareTotal)}</strong>
      </div>
      {shareTotal > 0 && (
        <p className="muted">
          {closesTable
            ? "This pays the last of the bill and closes the table."
            : `${money(remainingAfter)} will still be due.`}
        </p>
      )}
      <label>
        Payment method
        <select value={payment} onChange={(e) => setPayment(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>
      </label>
      <footer>
        <button onClick={onClose}>Done</button>
        <button
          className="primary"
          disabled={busy || shareTotal <= 0}
          onClick={() => onSave(payment, shareItems)}
        >
          {closesTable ? "Record payment & close" : "Record this share"}
        </button>
      </footer>
    </Modal>
  );
}
function Transfer({
  order,
  tables,
  open,
  split,
  onClose,
  onSave,
}: {
  order: Order;
  tables: Table[];
  open: Order[];
  split: string[];
  onClose: () => void;
  onSave: (type: string, p: any) => Promise<void>;
}) {
  const [mode, setMode] = useState("move");
  const [dest, setDest] = useState("");
  const available = tables.filter(
    (t) =>
      t.id !== order.tableId &&
      (mode === "merge"
        ? open.some((o) => o.tableId === t.id)
        : !open.some((o) => o.tableId === t.id)),
  );
  return (
    <Modal title="Move, merge or split" onClose={onClose}>
      <label>
        Action
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setDest("");
          }}
        >
          <option value="move">Move whole order to an empty table</option>
          <option value="merge">Merge into another open order</option>
          <option value="split">Move selected items to an empty table</option>
        </select>
      </label>
      {mode === "split" && (
        <p>
          {split.length} lines selected. Select item checkboxes in the order
          before splitting. Whole lines, including all their quantity, move
          together.
        </p>
      )}
      <label>
        Destination table
        <select value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">Choose table</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <footer>
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={!dest || (mode === "split" && !split.length)}
          onClick={() => {
            const target = open.find((o) => o.tableId === dest);
            onSave(
              "order." + mode,
              mode === "merge"
                ? { targetOrderId: target?.id, targetVersion: target?.version }
                : { tableId: dest, itemIds: split },
            );
          }}
        >
          <Scissors size={17} />
          Confirm {mode}
        </button>
      </footer>
    </Modal>
  );
}
function SettingsForm({
  settings,
  onSave,
}: {
  settings: State["settings"];
  onSave: (s: State["settings"], pin?: string) => Promise<any>;
}) {
  const [p, setP] = useState(settings);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  return (
    <section className="panel padded">
      <h2>Restaurant & tickets</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin || pinConfirm) {
            if (pin !== pinConfirm) {
              setPinError("PIN confirmation does not match");
              return;
            }
            if (!/^\d{4,12}$/.test(pin)) {
              setPinError("PIN must be 4 to 12 digits");
              return;
            }
          }
          setPinError("");
          onSave(p, pin || undefined);
        }}
      >
        <label>
          Restaurant name
          <input
            required
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Currency
            <input
              maxLength={3}
              required
              value={p.currency}
              onChange={(e) =>
                setP({ ...p, currency: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Accent colour
            <input
              type="color"
              value={p.accent}
              onChange={(e) => setP({ ...p, accent: e.target.value })}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Paper width
            <select
              value={p.paperWidth}
              onChange={(e) =>
                setP({ ...p, paperWidth: Number(e.target.value) })
              }
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </label>
          <label>
            Ticket text size
            <input
              type="number"
              min={10}
              max={36}
              required
              value={p.ticketFont}
              onChange={(e) =>
                setP({ ...p, ticketFont: Number(e.target.value) })
              }
            />
            <small>
              Kitchen tickets print larger than this so cooks can read them.
            </small>
          </label>
        </div>
        <label>
          Ticket footer
          <textarea
            maxLength={300}
            value={p.ticketFooter}
            onChange={(e) => setP({ ...p, ticketFooter: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            {settings.managerPinHash ? "New manager PIN" : "Manager PIN"}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={settings.managerPinHash ? "Leave blank to keep" : ""}
            />
          </label>
          <label>
            Confirm PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value)}
            />
          </label>
        </div>
        {pinError && <p className="danger-text">{pinError}</p>}
        <button className="primary">Save settings</button>
      </form>
    </section>
  );
}
function PinGate({
  hasPin,
  onUnlock,
}: {
  hasPin: boolean;
  onUnlock: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel padded pin-gate">
      <LockKeyhole size={28} />
      <h2>{hasPin ? "Enter manager PIN" : "Set a manager PIN"}</h2>
      <p className="muted">
        {hasPin
          ? "Settings stay locked until this device enters the PIN."
          : "Choose a 4 to 12 digit PIN the first time you open Settings."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!hasPin && pin !== confirm) return;
          setBusy(true);
          try {
            await onUnlock(pin);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          PIN
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            required
            minLength={4}
            maxLength={12}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        {!hasPin && (
          <label>
            Confirm PIN
            <input
              type="password"
              inputMode="numeric"
              required
              minLength={4}
              maxLength={12}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}
        {!hasPin && pin && pin !== confirm && (
          <p className="danger-text">PIN confirmation does not match</p>
        )}
        <button className="primary" disabled={busy || (!hasPin && pin !== confirm)}>
          {hasPin ? "Unlock" : "Set PIN"}
        </button>
      </form>
    </section>
  );
}
function Analytics({
  orders,
  money,
}: {
  orders: Order[];
  money: (v: number) => string;
}) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  const weekday = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const today = orders.filter(
    (o) => o.closedAt && new Date(o.closedAt) >= startOfDay,
  );
  const week = orders.filter(
    (o) => o.closedAt && new Date(o.closedAt) >= startOfWeek,
  );
  const weekTotal = week.reduce((n, o) => n + (o.paidTotal || 0), 0);
  const todayTotal = today.reduce((n, o) => n + (o.paidTotal || 0), 0);
  const dishes = new Map<string, { qty: number; total: number }>();
  for (const order of week) {
    for (const item of order.items.filter((i) => !i.voided)) {
      const row = dishes.get(item.name) || { qty: 0, total: 0 };
      row.qty += item.qty;
      row.total += lineAmount(item);
      dishes.set(item.name, row);
    }
  }
  const top = [...dishes.entries()]
    .sort((a, b) => b[1].qty - a[1].qty || b[1].total - a[1].total)
    .slice(0, 8);
  return (
    <>
      <div className="stats">
        <div>
          <span>Paid today</span>
          <strong>{money(todayTotal)}</strong>
        </div>
        <div>
          <span>Paid this week</span>
          <strong>{money(weekTotal)}</strong>
        </div>
        <div>
          <span>Orders this week</span>
          <strong>{week.length}</strong>
        </div>
        <div>
          <span>Average ticket</span>
          <strong>{money(week.length ? Math.round(weekTotal / week.length) : 0)}</strong>
        </div>
      </div>
      <section className="panel padded">
        <h2>Top dishes this week</h2>
        {!top.length && (
          <p className="muted">Paid orders this week will appear here.</p>
        )}
        {top.map(([name, row]) => (
          <div className="settings-row" key={name}>
            <div>
              <strong>{name}</strong>
              <small>
                {row.qty} sold
              </small>
            </div>
            <strong>{money(row.total)}</strong>
          </div>
        ))}
      </section>
    </>
  );
}
function updateLabel(update?: {
  state?: string;
  nextVersion?: string;
  percent?: number;
  error?: string;
}) {
  switch (update?.state) {
    case "dev":
      return "Updates are checked in the installed Windows app, not in development.";
    case "checking":
      return "Checking for an update…";
    case "available":
      return `Version ${update.nextVersion} is available and will download now.`;
    case "downloading":
      return `Downloading version ${update.nextVersion || ""}… ${update.percent || 0}%`;
    case "ready":
      return `Version ${update.nextVersion} is ready. Restart after service to install it.`;
    case "current":
      return "This computer is on the latest version.";
    case "error":
      return update.error || "The update check failed.";
    case "unconfigured":
      return "Set an update address so restaurant PCs can find new installers.";
    default:
      return "The app checks for updates when it starts and every few hours.";
  }
}
function UpdateSettings({
  info,
  setInfo,
  onError,
}: {
  info: any;
  setInfo: (v: any) => void;
  onError: (s: string) => void;
}) {
  const [url, setUrl] = useState(info?.updateUrl || "");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setUrl(info?.updateUrl || "");
  }, [info?.updateUrl]);
  async function run(fn: () => Promise<any>) {
    try {
      await fn();
      setInfo(await ipc("info"));
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <>
      <p role="status">{updateLabel(info?.update)}</p>
      <label>
        Update address
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="github:OgnyanTatarov/restaurant-pos"
        />
      </label>
      <small>
        Leave this blank to use GitHub Releases for
        OgnyanTatarov/restaurant-pos. Only change it if this computer should
        look somewhere else.
      </small>
      <div className="row">
        <button
          className="primary"
          onClick={() =>
            run(async () => {
              await ipc("saveUpdateUrl", url);
              setMessage("Update address saved");
            })
          }
        >
          Save update address
        </button>
        <button
          onClick={() =>
            run(async () => {
              await ipc("checkUpdate");
              setMessage("Checked for updates");
            })
          }
        >
          Check now
        </button>
        {info?.update?.state === "ready" && (
          <button onClick={() => ipc("installUpdate")}>Restart now</button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </>
  );
}
function DesktopSettings({
  info,
  setInfo,
  onError,
}: {
  info: any;
  setInfo: (v: any) => void;
  onError: (s: string) => void;
}) {
  const [devices, setDevices] = useState<any[]>([]);
  const [named, setNamed] = useState<NamedPrinter[]>([]);
  const [assigned, setAssigned] = useState({
    kitchen: "",
    bar: "",
    bill: "",
  });
  const [pair, setPair] = useState<any>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("waiter");
  const [message, setMessage] = useState("");
  useEffect(() => {
    ipc("printers")
      .then(setDevices)
      .catch((e) => onError(e.message));
  }, []);
  useEffect(() => {
    const p = info?.printers;
    if (!p) return;
    setNamed(Array.isArray(p.named) ? p.named : []);
    setAssigned({
      kitchen: p.kitchen || "",
      bar: p.bar || "",
      bill: p.bill || "",
    });
  }, [info]);
  async function run(fn: () => Promise<any>) {
    try {
      await fn();
      setInfo(await ipc("info"));
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function setPrinter(id: string, patch: Partial<NamedPrinter>) {
    setNamed((list) =>
      list.map((printer) =>
        printer.id === id ? { ...printer, ...patch } : printer,
      ),
    );
  }
  return (
    <>
      <section className="panel padded">
        <h2>Printers</h2>
        <p>
          Name each Windows printer, for example Upstairs or Downstairs, then
          choose what it prints. Phones can pick a named printer when they
          print a bill.
        </p>
        {named.map((printer) => (
          <div className="printer-row" key={printer.id}>
            <label>
              Name
              <input
                maxLength={40}
                value={printer.name}
                placeholder="Upstairs"
                onChange={(e) =>
                  setPrinter(printer.id, { name: e.target.value })
                }
              />
            </label>
            <label>
              Windows printer
              <select
                value={printer.device || ""}
                onChange={(e) =>
                  setPrinter(printer.id, { device: e.target.value })
                }
              >
                <option value="">Choose printer</option>
                {devices.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName || p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon danger-text"
              aria-label={`Remove ${printer.name || "printer"}`}
              onClick={() => {
                setNamed((list) => list.filter((p) => p.id !== printer.id));
                setAssigned((current) => ({
                  kitchen:
                    current.kitchen === printer.id ? "" : current.kitchen,
                  bar: current.bar === printer.id ? "" : current.bar,
                  bill: current.bill === printer.id ? "" : current.bill,
                }));
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <div className="row">
          <button
            disabled={named.length >= 12}
            onClick={() =>
              setNamed((list) => [
                ...list,
                { id: crypto.randomUUID(), name: "", device: "" },
              ])
            }
          >
            <Plus size={16} />
            Add printer
          </button>
          <button onClick={() => ipc("printers").then(setDevices)}>
            Refresh
          </button>
        </div>
        {(
          [
            ["kitchen", "Kitchen tickets"],
            ["bar", "Bar tickets"],
            ["bill", "Bills"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={assigned[key]}
              onChange={(e) =>
                setAssigned({ ...assigned, [key]: e.target.value })
              }
            >
              <option value="">Choose a named printer</option>
              {named.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Untitled printer"}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="row">
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                await ipc("savePrinters", { named, ...assigned });
                setMessage("Printer settings saved");
              })
            }
          >
            Save printers
          </button>
        </div>
        <div className="row spaced">
          {(["kitchen", "bar", "bill"] as const).map((station) => (
            <button
              key={station}
              onClick={() =>
                run(async () => {
                  await ipc("testPrint", station);
                  setMessage(`${station} test sent`);
                })
              }
            >
              Test {station === "bill" ? "bill" : station}
            </button>
          ))}
        </div>
        {message && <p role="status">{message}</p>}
      </section>
      <section className="panel padded">
        <h2>Pair a phone or tablet</h2>
        {info?.hubError && (
          <p className="danger-text">Local hub error: {info.hubError}</p>
        )}
        <p>
          Use the same restaurant network. Enter one of these hub addresses in
          the mobile app:
        </p>
        {info?.addresses?.map((a: string) => (
          <code key={a} className="address">
            {a}
          </code>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => setPair(await ipc("pair", { name, role })));
          }}
        >
          <label>
            Device name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Waiter phone"
            />
          </label>
          <label>
            Permission
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="waiter">Waiter</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <button>
            <Smartphone size={17} />
            Create pairing token
          </button>
        </form>
        {pair && (
          <div className="pairing">
            <strong>Token for {pair.name}</strong>
            <p>Copy to this device only. It grants the selected access.</p>
            <textarea readOnly value={pair.token} />
          </div>
        )}
        {info?.devices
          ?.filter((d: any) => !d.revoked)
          .map((d: any) => (
            <div className="settings-row" key={d.id}>
              <div>
                <strong>{d.name}</strong>
                <small>{d.role}</small>
              </div>
              <button onClick={() => run(() => ipc("revoke", d.id))}>
                Revoke
              </button>
            </div>
          ))}
      </section>
      <section className="panel padded">
        <h2>App updates</h2>
        <p>
          Installed version {info?.version || "…"}. After you publish a newer
          installer, every Windows PC checks this address and installs it.
        </p>
        <UpdateSettings info={info} onError={onError} setInfo={setInfo} />
      </section>
      <section className="panel padded">
        <h2>Supabase & local data</h2>
        <p>{info?.cloud?.message || "Not configured"}</p>
        <p>
          Follow docs/SUPABASE.md to connect your project. Keep the server key
          on this computer only.
        </p>
        <small>Data folder</small>
        <code className="address">{info?.dataPath}</code>
      </section>
    </>
  );
}
function Connect({ onDone }: { onDone: () => void }) {
  const [c, setC] = useState<Connection>(connection);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="connect-page">
      <section className="connect-card">
        <div className="brand-mark">
          <UtensilsCrossed />
        </div>
        <span className="eyebrow">RESTAURANT POS</span>
        <h1>Join your restaurant</h1>
        <p>
          Connect this app to the Windows hub or your configured Supabase
          project.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              pending() &&
              !window.confirm(
                "An action is still pending. Check its outcome on the desktop before changing connection. Continue?",
              )
            )
              return;
            setBusy(true);
            setError("");
            try {
              configure(c);
              if (c.mode === "cloud") await login(email, password);
              await getState();
              onDone();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Connection
            <select
              value={c.mode}
              onChange={(e) =>
                setC({ ...c, mode: e.target.value as "lan" | "cloud" })
              }
            >
              <option value="lan">Restaurant Wi-Fi (local hub)</option>
              <option value="cloud">Supabase (internet)</option>
            </select>
          </label>
          <label>
            {c.mode === "lan" ? "Windows hub address" : "Supabase project URL"}
            <input
              type="url"
              required
              placeholder={
                c.mode === "lan"
                  ? "http://192.168.1.20:47831"
                  : "https://your-project.supabase.co"
              }
              value={c.url}
              onChange={(e) => setC({ ...c, url: e.target.value })}
            />
          </label>
          {c.mode === "lan" ? (
            <label>
              Pairing token
              <input
                required
                type="password"
                value={c.token}
                onChange={(e) => setC({ ...c, token: e.target.value.trim() })}
              />
            </label>
          ) : (
            <>
              <label>
                Publishable / anon key
                <input
                  required
                  value={c.key}
                  onChange={(e) => setC({ ...c, key: e.target.value.trim() })}
                />
              </label>
              <label>
                Restaurant ID
                <input
                  required
                  value={c.restaurantId}
                  onChange={(e) =>
                    setC({ ...c, restaurantId: e.target.value.trim() })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="danger-text">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            <LockKeyhole size={17} />
            {busy ? "Connecting…" : "Connect app"}
          </button>
        </form>
        <small>
          Get your address and pairing token from Settings on the Windows app.
        </small>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
