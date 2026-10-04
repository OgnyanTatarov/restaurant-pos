"use client";

import { useEffect, useState } from "react";

export type CartExtra = { id: string; name: string; price: number };
export type CartLeave = { id: string; name: string };
export type CartLine = {
  menuId: string;
  name: string;
  price: number;
  qty: number;
  cookId: string;
  cookName: string;
  sideId: string;
  sideName: string;
  sidePrice: number;
  extras: CartExtra[];
  leaveouts: CartLeave[];
  note: string;
};

const KEY = "angel.order";
const EVENT = "angel-order";

function lineKey(
  line: Pick<CartLine, "menuId" | "cookId" | "sideId" | "extras" | "leaveouts" | "note">,
) {
  const extras = (line.extras || []).map((extra) => extra.id).sort().join(",");
  const leaveouts = (line.leaveouts || []).map((mod) => mod.id).sort().join(",");
  return `${line.menuId}|${line.cookId}|${line.sideId}|${extras}|${leaveouts}|${line.note || ""}`;
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(line: Omit<CartLine, "qty"> & { qty?: number }) {
  const next = readCart();
  const key = lineKey(line);
  const existing = next.find((item) => lineKey(item) === key);
  if (existing) existing.qty = Math.min(20, existing.qty + (line.qty || 1));
  else
    next.push({
      menuId: line.menuId,
      name: line.name,
      price: line.price,
      qty: Math.min(20, line.qty || 1),
      cookId: line.cookId || "",
      cookName: line.cookName || "",
      sideId: line.sideId || "",
      sideName: line.sideName || "",
      sidePrice: line.sidePrice || 0,
      extras: line.extras || [],
      leaveouts: line.leaveouts || [],
      note: line.note || "",
    });
  writeCart(next);
}

export function changeQty(
  line: Pick<CartLine, "menuId" | "cookId" | "sideId">,
  qty: number,
) {
  const key = lineKey(line);
  writeCart(
    readCart()
      .map((item) =>
        lineKey(item) === key ? { ...item, qty: Math.min(20, qty) } : item,
      )
      .filter((item) => item.qty > 0),
  );
}

export function clearCart() {
  writeCart([]);
}

export function lineTotal(line: CartLine) {
  const extras = (line.extras || []).reduce((sum, extra) => sum + (extra.price || 0), 0);
  return (line.price + (line.sidePrice || 0) + extras) * line.qty;
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    const load = () => setLines(readCart());
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return lines;
}
