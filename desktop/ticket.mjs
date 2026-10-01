import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const logoSrc = `data:image/png;base64,${readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "angel-logo.png"),
).toString("base64")}`;
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const unitAmount = (i) =>
  (i.price || 0) +
  (i.choices?.side?.price || 0) +
  (i.choices?.extras || []).reduce((n, extra) => n + (extra.price || 0), 0);
const unpaidQty = (i) =>
  i.voided ? 0 : Math.max(0, (i.qty || 0) - (i.paidQty || 0));
const money = (settings, n) =>
  `${settings.currency || ""} ${((n || 0) / 100).toFixed(2)}`.trim();
const amount = (n) => ((n || 0) / 100).toFixed(2);
const placedAt = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
export function billStatus(job) {
  const items = (job.items || []).filter((i) => !i.voided);
  const due = items.reduce((n, i) => n + unitAmount(i) * unpaidQty(i), 0);
  const method = String(job.payment || "").toLowerCase();
  const labels = { cash: "CASH", card: "CARD", other: "OTHER", split: "SPLIT" };
  if (!method || (due > 0 && method === "")) return "NOT PAID";
  if (labels[method]) return labels[method];
  return due > 0 ? "NOT PAID" : "PAID";
}
export function ticketLines(item) {
  const lines = [];
  if (item.choices?.cook) lines.push(`Cook: ${item.choices.cook.name}`);
  if (item.choices?.side) lines.push(`Side: ${item.choices.side.name}`);
  for (const extra of item.choices?.extras || [])
    lines.push(`+ ${extra.name}`);
  for (const leave of item.choices?.leaveouts || [])
    lines.push(`No ${leave.name}`);
  if (item.note) lines.push(item.note);
  return lines;
}
export function ticketSizes(settings, station) {
  const base = Math.min(36, Math.max(10, Number(settings.ticketFont) || 20));
  const kitchen = station === "kitchen";
  const body = kitchen ? Math.round(base * 1.5) : base;
  return {
    body,
    title: kitchen ? Math.round(body * 1.35) : Math.round(body * 1.25),
    heading: kitchen ? Math.round(body * 1.15) : Math.round(body * 1.1),
    item: kitchen ? Math.round(body * 1.2) : Math.round(body * 1.15),
    meta: Math.max(11, Math.round(body * 0.65)),
    cook: kitchen ? Math.round(body * 1.15) : body,
  };
}
export function paperMm(settings) {
  const width = Number(settings?.paperWidth);
  return [58, 80].includes(width) ? width : 80;
}
function sheet(settings, station, body) {
  const s = ticketSizes(settings, station);
  const paper = paperMm(settings);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{margin:0;size:${paper}mm auto}html,body{width:${paper}mm;margin:0;padding:2mm 4mm;box-sizing:border-box;overflow:hidden;font:${s.body}px/${Math.round(s.body * 1.2)}px monospace;color:#000}h1{font-size:${s.title}px;margin:6px 0}h2{font-size:${s.heading}px;margin:4px 0}article{border-top:1px dashed;padding:8px 0}small{font-size:${s.meta}px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0}strong{font-size:${s.item}px;overflow-wrap:anywhere}.cook{font-size:${s.cook}px;font-weight:700}.center{text-align:center}img.logo{display:block;width:46mm;max-width:100%;height:auto;margin:0 auto 2mm}table.lines{width:100%;border-collapse:collapse}table.lines td{vertical-align:top;font-weight:700;font-size:${s.item}px}table.lines td.amt{white-space:nowrap;text-align:right;width:1%;padding-left:8px}ul.mods{margin:2px 0 8px;padding:0;list-style:none}ul.mods li{margin:0}.rule{border-top:1px dashed #000;margin:8px 0}.sum{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:2px 0;font-weight:700}.sum span:last-child{white-space:nowrap}.pay{background:#000;color:#fff;text-align:center;font-weight:700;letter-spacing:1px;padding:8px 4px;margin:10px 0}</style></head><body>${body}</body></html>`;
}
function itemBlock(i) {
  const lines = ticketLines(i);
  const cook = lines.filter((line) => line.startsWith("Cook:"));
  const rest = lines.filter((line) => !line.startsWith("Cook:"));
  return `<article><strong>${i.qty} × ${escape(i.name)}</strong>${
    cook.length ? `<p class="cook">${escape(cook.join("\n"))}</p>` : ""
  }${rest.length ? `<p>${escape(rest.join("\n"))}</p>` : ""}</article>`;
}
export function ticketHtml(job, settings) {
  const kitchen = job.station === "kitchen";
  const heading = kitchen
    ? "KITCHEN"
    : `${String(job.station || "").toUpperCase()} · ${job.kind || ""}`;
  const meta = kitchen
    ? escape(new Date(job.createdAt).toLocaleString())
    : `${escape(new Date(job.createdAt).toLocaleString())}<br>${escape(job.actor)}<br>Ticket ${escape(job.id)}`;
  return sheet(
    settings,
    job.station,
    `<h2>${escape(settings.name)}</h2><h1>${escape(heading)}</h1><h2>${escape(job.tableName)}</h2><small>${meta}</small>${(job.items || []).map(itemBlock).join("")}<p>${escape(settings.ticketFooter)}</p>`,
  );
}
function billNotes(item) {
  const lines = [];
  if (item.choices?.cook) lines.push(item.choices.cook.name);
  for (const leave of item.choices?.leaveouts || [])
    lines.push(`NO ${leave.name}`);
  if (item.choices?.side) lines.push(item.choices.side.name);
  for (const extra of item.choices?.extras || []) lines.push(extra.name);
  if (item.note) lines.push(item.note);
  return lines;
}
export function billHtml(job, settings) {
  const items = (job.items || []).filter((i) => !i.voided);
  const total = items.reduce((n, i) => n + unitAmount(i) * i.qty, 0);
  const due = items.reduce((n, i) => n + unitAmount(i) * unpaidQty(i), 0);
  const paid = total - due;
  const lines = items
    .map((i) => {
      const notes = billNotes(i);
      return `<table class="lines"><tr><td>${i.qty}x ${escape(i.name)}</td><td class="amt">${amount(unitAmount(i) * i.qty)}</td></tr></table>${
        notes.length
          ? `<ul class="mods">${notes.map((line) => `<li>· ${escape(line)}</li>`).join("")}</ul>`
          : ""
      }`;
    })
    .join("");
  return sheet(
    settings,
    "bill",
    `<img class="logo" alt="" src="${logoSrc}"><h1 class="center">${escape(settings.name)}</h1><p class="center">Table: ${escape(job.tableName)}</p>${lines}<div class="rule"></div><p class="sum"><span>SUB TOTAL</span><span>${amount(total)}</span></p><p class="sum"><span>TOTAL</span><span>${amount(total)}</span></p>${
      paid
        ? `<p class="sum"><span>PAID</span><span>${amount(paid)}</span></p><p class="sum"><span>DUE</span><span>${amount(due)}</span></p>`
        : ""
    }<div class="pay">${escape(billStatus(job))}</div><p>Placed: ${escape(placedAt(job.placedAt || job.createdAt))}</p><p class="center">${escape(settings.ticketFooter)}</p>`,
  );
}
