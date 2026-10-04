"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import MenuCarousel from "../components/MenuCarousel";
import OrderLink from "../components/OrderLink";
import { changeQty, clearCart, lineTotal, useCart } from "../../lib/cart";
import { placeOrder, pounds } from "../../lib/restaurant";

export default function OrderPage() {
  const lines = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [fulfilment, setFulfilment] = useState<"collection" | "delivery">("collection");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!lines.length) {
      setError("Add a dish before placing the order");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await placeOrder({
        name,
        phone,
        note,
        fulfilment,
        address,
        items: lines.map((line) => ({
          menuId: line.menuId,
          qty: line.qty,
          cookId: line.cookId || undefined,
          sideId: line.sideId || undefined,
          extraIds: (line.extras || []).map((extra) => extra.id),
          leaveoutIds: (line.leaveouts || []).map((mod) => mod.id),
          note: line.note || undefined,
        })),
      });
      clearCart();
      setDone(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-50 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 md:px-16 py-4 sm:py-6 bg-[#0a0a0a]/80 backdrop-blur-md gap-3">
        <Link href="/" className="text-lg sm:text-2xl font-bold text-[#ff8c00] tracking-wider">
          ANGEL STEAKHOUSE
        </Link>
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/#menu" className="text-sm hover:text-[#ff8c00]">
            Menu
          </Link>
          <OrderLink />
          <Link
            href="/book-a-table"
            className="bg-white/10 text-white px-4 py-2 text-xs sm:text-sm font-bold rounded"
          >
            BOOK A TABLE
          </Link>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24">
        {done ? (
          <div className="max-w-xl mx-auto text-center py-24">
            <div className="text-xs tracking-[3px] text-[#4a9eff] uppercase">
              Order received
            </div>
            <h1 className="mt-4 text-4xl font-black">
              Thanks, we have your order
            </h1>
            <p className="mt-4 text-[#cccccc]">
              {pounds(done.total)} · reference {done.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-2 text-[#cccccc]">
              The kitchen has it. We will call if we need anything.
            </p>
            <Link
              href="/"
              className="inline-block mt-8 bg-[#ff8c00] text-black px-8 py-3 font-bold rounded"
            >
              Back home
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            <MenuCarousel showCart={false} />
            <aside className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-black/40 p-6">
              <h2 className="text-2xl font-bold">Your order</h2>
              {!lines.length && (
                <p className="mt-4 text-[#cccccc]">Add dishes from the menu.</p>
              )}
              <ul className="mt-4 space-y-4">
                {lines.map((line) => (
                  <li key={`${line.menuId}|${line.cookId}|${line.sideId}|${(line.extras || []).map((extra) => extra.id).join()}|${(line.leaveouts || []).map((mod) => mod.id).join()}`}>
                    <div className="flex justify-between gap-3">
                      <span>
                        {line.name}
                        {(line.cookName || line.sideName || line.extras?.length || line.leaveouts?.length) && (
                          <small className="block text-[#cccccc]">
                            {[
                              line.cookName,
                              line.sideName,
                              ...(line.leaveouts || []).map((mod) => `No ${mod.name}`),
                              ...(line.extras || []).map((extra) => extra.name),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                      </span>
                      <span>{pounds(lineTotal(line))}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => changeQty(line, line.qty - 1)}
                        className="h-8 w-8 rounded-full border border-white/20"
                      >
                        −
                      </button>
                      <span>{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(line, line.qty + 1)}
                        className="h-8 w-8 rounded-full border border-white/20"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {lines.length > 0 && (
                <p className="mt-4 text-xl font-bold">{pounds(total)}</p>
              )}
              <form onSubmit={submit} className="mt-6 space-y-3">
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                  className="w-full rounded-lg bg-black border border-white/15 px-4 py-3"
                />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Phone"
                  maxLength={40}
                  className="w-full rounded-lg bg-black border border-white/15 px-4 py-3"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["collection", "delivery"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFulfilment(option)}
                      className={`py-3 rounded-lg font-bold capitalize border ${
                        fulfilment === option
                          ? "bg-[#ff8c00] text-black border-[#ff8c00]"
                          : "border-white/15"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {fulfilment === "delivery" && (
                  <textarea
                    required
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Delivery address"
                    maxLength={200}
                    className="w-full rounded-lg bg-black border border-white/15 px-4 py-3"
                  />
                )}
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note for the kitchen"
                  maxLength={300}
                  className="w-full rounded-lg bg-black border border-white/15 px-4 py-3"
                />
                {error && <p className="text-[#ff8c00]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || !lines.length}
                  className="w-full bg-[#ff8c00] text-black py-3 font-bold rounded disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Place order"}
                </button>
              </form>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
