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
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{margin:0;size:${paper}mm auto}html,body{width:${paper}mm;margin:0;padding:2mm 12mm 2mm 2mm;box-sizing:border-box;overflow:hidden;font:${s.body}px/${Math.round(s.body * 1.2)}px monospace;color:#000}h1{font-size:${s.title}px;margin:6px 0}h2{font-size:${s.heading}px;margin:4px 0}article{border-top:1px dashed;padding:8px 0}small{font-size:${s.meta}px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0}strong{font-size:${s.item}px;overflow-wrap:anywhere}.cook{font-size:${s.cook}px;font-weight:700}.price{display:block;margin:2px 0 0;text-align:right;white-space:nowrap;font-weight:700}.sum{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:4px 0}.sum .price{margin:0}.total,.due{font-weight:700}</style></head><body>${body}</body></html>`;
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
export function billHtml(job, settings) {
  const items = (job.items || []).filter((i) => !i.voided);
  const total = items.reduce((n, i) => n + unitAmount(i) * i.qty, 0);
  const due = items.reduce((n, i) => n + unitAmount(i) * unpaidQty(i), 0);
  const paid = total - due;
  const lines = items
    .map((i) => {
      const extra = ticketLines(i);
      const paidQty = i.paidQty || 0;
      return `<article><strong>${i.qty} × ${escape(i.name)}</strong><div class="price">${escape(money(settings, unitAmount(i) * i.qty))}</div>${
        extra.length ? `<p>${escape(extra.join("\n"))}</p>` : ""
      }${paidQty ? `<p>Paid qty: ${paidQty}</p>` : ""}</article>`;
    })
    .join("");
  return sheet(
    settings,
    "bill",
    `<h2>${escape(settings.name)}</h2><h1>BILL</h1><h2>${escape(job.tableName)}</h2><small>${escape(new Date(job.createdAt).toLocaleString())}<br>${escape(job.actor)}</small>${lines}<p class="sum total"><span>Total</span><span class="price">${escape(money(settings, total))}</span></p>${
      paid
        ? `<p class="sum"><span>Paid</span><span class="price">${escape(money(settings, paid))}</span></p><p class="sum due"><span>Due</span><span class="price">${escape(money(settings, due))}</span></p>`
        : ""
    }<p>${escape(settings.ticketFooter)}</p>`,
  );
}
