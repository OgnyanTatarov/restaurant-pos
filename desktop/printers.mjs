import { randomUUID } from "node:crypto";

const stations = ["kitchen", "bar", "bill"];

export function normalizePrinters(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const named = [];
  const add = (name, device, id) => {
    const nextName = String(name || "").trim().slice(0, 40);
    const nextDevice = String(device || "").trim().slice(0, 200);
    if (!nextName && !nextDevice) return;
    if (named.some((p) => p.device && p.device === nextDevice)) return;
    named.push({
      id:
        typeof id === "string" && id.trim()
          ? id.trim().slice(0, 80)
          : randomUUID(),
      name: nextName || "Printer",
      device: nextDevice,
    });
  };
  if (Array.isArray(input.named)) {
    for (const printer of input.named.slice(0, 12)) {
      if (!printer || typeof printer !== "object") continue;
      add(printer.name, printer.device, printer.id);
    }
  }
  if (!named.length) {
    for (const station of stations) {
      if (typeof input[station] === "string" && input[station].trim())
        add(
          station === "bill" ? "Bills" : station[0].toUpperCase() + station.slice(1),
          input[station],
        );
    }
  }
  const assignment = (key) => {
    if (typeof input[key] !== "string" || !input[key].trim()) return "";
    const value = input[key].trim();
    if (named.some((p) => p.id === value)) return value;
    return named.find((p) => p.device === value)?.id || "";
  };
  return {
    named,
    kitchen: assignment("kitchen"),
    bar: assignment("bar"),
    bill: assignment("bill"),
  };
}

export function publicPrinters(printers) {
  const config = normalizePrinters(printers);
  return {
    named: config.named.map((p) => ({ id: p.id, name: p.name })),
    kitchen: config.kitchen,
    bar: config.bar,
    bill: config.bill,
  };
}

export function deviceForJob(printers, job) {
  const config = normalizePrinters(printers);
  const pick = (id) => config.named.find((p) => p.id === id);
  const chosen = pick(job?.printerId) || pick(config[job?.station]);
  const label =
    job?.station === "bill"
      ? "bill"
      : job?.station === "bar"
        ? "bar"
        : "kitchen";
  if (!chosen)
    throw Error(`Choose a ${label} printer in Settings`);
  if (!chosen.device)
    throw Error(`Assign a Windows printer to ${chosen.name}`);
  return chosen.device;
}
