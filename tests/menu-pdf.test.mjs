import test from "node:test";
import assert from "node:assert/strict";
import { menuFromLines, menuFromTextItems } from "../core/menu-pdf.mjs";

test("a menu PDF becomes categories and priced dishes", () => {
  const parsed = menuFromLines([
    "ANGEL STEAKHOUSE",
    "STARTERS",
    "Soup of the day .... 6.50",
    "MAINS",
    "Ribeye steak £28.00",
    "Fish and chips 16.50",
    "DRINKS",
    "House red 7.00",
    "Please ask about allergens",
  ]);
  assert.deepEqual(
    parsed.categories.map((category) => category.name),
    ["STARTERS", "MAINS", "DRINKS"],
  );
  assert.deepEqual(
    parsed.menu.map((item) => [item.name, item.price, item.category, item.station]),
    [
      ["Soup of the day", 650, "STARTERS", "kitchen"],
      ["Ribeye steak", 2800, "MAINS", "kitchen"],
      ["Fish and chips", 1650, "MAINS", "kitchen"],
      ["House red", 700, "DRINKS", "bar"],
    ],
  );
  assert.deepEqual(
    parsed.menu.find((item) => item.name === "Ribeye steak").cookOptions.map((cook) => cook.name),
    ["Blue", "Rare", "Medium rare", "Medium", "Medium well", "Well done"],
  );
});

test("prices on the same line are joined by their Y position", () => {
  const parsed = menuFromTextItems([
    { str: "STARTERS", x: 40, y: 400 },
    { str: "6.50", x: 220, y: 360 },
    { str: "Soup", x: 40, y: 360 },
    { str: "of the day", x: 80, y: 360 },
  ]);
  assert.equal(parsed.menu.length, 1);
  assert.equal(parsed.menu[0].name, "Soup of the day");
  assert.equal(parsed.menu[0].price, 650);
  assert.equal(parsed.menu[0].category, "STARTERS");
});

test("weights and table numbers are not prices", () => {
  const parsed = menuFromLines([
    "MAINS",
    "Ribeye 300g",
    "Table 12",
    "Sirloin 24",
    "Fillet 32.00",
  ]);
  assert.deepEqual(
    parsed.menu.map((item) => item.name),
    ["Fillet"],
  );
});

test("pdf.js text from a menu page becomes a dish", async () => {
  const { getDocument, GlobalWorkerOptions } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );
  const { pathToFileURL } = await import("node:url");
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  ).href;
  const stream = [
    "BT",
    "/F1 12 Tf",
    "1 0 0 1 40 500 Tm (MAINS) Tj",
    "1 0 0 1 40 460 Tm (Ribeye steak) Tj",
    "1 0 0 1 220 460 Tm (28.00) Tj",
    "ET",
  ].join("\n");
  const pdf = await getDocument({
    data: samplePdf(stream),
    verbosity: 0,
  }).promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => "str" in item && item.str.trim())
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
    }));
  await pdf.cleanup();
  const parsed = menuFromTextItems(items);
  assert.equal(parsed.menu[0].name, "Ribeye steak");
  assert.equal(parsed.menu[0].price, 2800);
  assert.equal(parsed.menu[0].category, "MAINS");
});

function samplePdf(stream) {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  body += "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++)
    body += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  body += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body));
}
