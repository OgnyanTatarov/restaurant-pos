const id = () => crypto.randomUUID();
const BAR =
  /\b(drinks?|wines?|beers?|cocktails?|spirits?|coffees?|teas?|beverages?|ciders?|juices?|whisk(?:y|ey)|gins?|vodkas?|soft drinks?|hot drinks?)\b/i;
const STEAK = /\b(steaks?|ribeye|rib-eye|sirloin|fillets?|filets?|rumps?|t-bone)\b/i;
const COOKS = [
  "Blue",
  "Rare",
  "Medium rare",
  "Medium",
  "Medium well",
  "Well done",
];
const PRICE =
  /(?:(£|\$|€)\s*)?(\d{1,4})(?:[.,](\d{2}))?(?:\s*(?:£|\$|€))?\s*$/;

export function linesFromTextItems(items) {
  const rows = [];
  for (const item of items || []) {
    const str = String(item?.str ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!str) continue;
    const x = Number(item.x ?? item.transform?.[4] ?? 0);
    const y = Number(item.y ?? item.transform?.[5] ?? 0);
    let row = rows.find((entry) => Math.abs(entry.y - y) < 2.5);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function pricedLine(line) {
  const match = line.match(PRICE);
  if (!match) return null;
  const symbol = match[1];
  const whole = match[2];
  const fraction = match[3];
  if (!symbol && fraction == null) return null;
  let name = line.slice(0, match.index).replace(/[.\s·\-–—:]+$/g, "").trim();
  name = name
    .replace(/(?:£|\$|€)\s*\d{1,4}(?:[.,]\d{2})?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || name.length > 80) return null;
  const price =
    fraction == null
      ? Number(whole) * 100
      : Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(price) || price < 0 || price > 10000000) return null;
  return { name, price };
}

function heading(line) {
  if (pricedLine(line)) return null;
  const name = line.replace(/[:\s]+$/g, "").trim();
  if (name.length < 2 || name.length > 40) return null;
  if (name.split(/\s+/).length > 5) return null;
  if (/[.!?]$/.test(name)) return null;
  if (/^(served|with|and|or|add|includes|all|please|ask|from)\b/i.test(name))
    return null;
  return name;
}

function dish(name, price, category) {
  return {
    id: id(),
    name,
    price,
    category,
    station: BAR.test(category) ? "bar" : "kitchen",
    available: true,
    deleted: false,
    image: "",
    modifiers: [],
    addonGroups: [],
    sideMode: "inherit",
    cookOptions: STEAK.test(name)
      ? COOKS.map((cook) => ({ id: id(), name: cook, deleted: false }))
      : [],
  };
}

export function menuFromLines(lines) {
  const categories = [];
  const menu = [];
  let current = "";
  const ensure = (name) => {
    if (!categories.some((category) => category.name === name))
      categories.push({
        id: id(),
        name,
        deleted: false,
        sideMode: "none",
        sides: [],
      });
    return name;
  };
  for (const line of lines || []) {
    const item = pricedLine(line);
    if (item) {
      const category = ensure(current || "Menu");
      menu.push(dish(item.name, item.price, category));
      continue;
    }
    const title = heading(line);
    if (title) current = title;
  }
  return {
    categories: categories.filter((category) =>
      menu.some((item) => item.category === category.name),
    ),
    menu,
  };
}

export function menuFromTextItems(items) {
  return menuFromLines(linesFromTextItems(items));
}
