"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DishPicker from "./DishPicker";
import { lineTotal, useCart } from "../../lib/cart";
import { addToCart } from "../../lib/cart";
import {
  loadMenu,
  needsChoice,
  pounds,
  type WebDish,
} from "../../lib/restaurant";

export default function MenuCarousel({ showCart = true }: { showCart?: boolean }) {
  const [dishes, setDishes] = useState<WebDish[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<WebDish | null>(null);
  const cart = useCart();

  useEffect(() => {
    let cancelled = false;
    loadMenu()
      .then((rows) => {
        if (cancelled) return;
        setDishes(rows);
        setCategory(rows[0]?.category || "");
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const names: string[] = [];
    for (const dish of dishes) {
      if (!names.includes(dish.category)) names.push(dish.category);
    }
    return names;
  }, [dishes]);
  const visible = dishes.filter((dish) => dish.category === category);
  const count = visible.length;
  const currency = dishes[0]?.currency || "GBP";
  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce((sum, line) => sum + lineTotal(line), 0);

  const go = useCallback(
    (next: number) => {
      if (!count) return;
      setIndex((next + count) % count);
    },
    [count],
  );

  function open(dish: WebDish) {
    if (!needsChoice(dish)) {
      addToCart({
        menuId: dish.id,
        name: dish.name,
        price: dish.price,
        cookId: "",
        cookName: "",
        sideId: "",
        sideName: "",
        sidePrice: 0,
        extras: [],
        leaveouts: [],
        note: "",
      });
      return;
    }
    setPending(dish);
  }

  const around = [-1, 0, 1].map((offset) => visible[(index + offset + count) % count]).filter(Boolean);

  return (
    <section id="menu" className="relative overflow-hidden bg-[#0a0a0a] py-20 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(101,67,33,0.15)_0%,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex gap-4 overflow-x-auto border-b border-white/10 pb-4">
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setCategory(name);
                setIndex(0);
              }}
              className={`shrink-0 px-4 py-3 text-sm font-bold uppercase tracking-wider ${
                category === name
                  ? "border-b-2 border-[#FF8A2A] text-[#FF8A2A]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        {loading && <p className="text-center text-[#cccccc]">Loading the menu…</p>}
        {error && <p className="text-center text-[#FF8A2A]">{error}</p>}
        {!loading && !error && !visible.length && (
          <p className="text-center text-[#cccccc]">Nothing is available to order right now.</p>
        )}
        {count > 0 && (
          <div className="flex items-center justify-center gap-4 md:gap-8">
            <button
              type="button"
              aria-label="Previous dish"
              onClick={() => go(index - 1)}
              className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white md:flex"
            >
              ‹
            </button>
            <div className="flex flex-1 items-stretch justify-center gap-4 md:gap-6">
              {around.map((dish, position) => {
                const center = position === 1 || count === 1;
                if (!center && count < 2) return null;
                return (
                  <article
                    key={`${dish.id}-${position}`}
                    className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 ${
                      center
                        ? "w-full md:w-[520px]"
                        : "hidden w-[380px] scale-90 opacity-60 md:block"
                    }`}
                  >
                    <div className="relative aspect-[4/5] bg-[radial-gradient(circle_at_30%_20%,rgba(255,140,0,0.45),transparent_55%),#120c08]">
                      {dish.image?.startsWith("http") || dish.image?.startsWith("data:image/") ? (
                        <img src={dish.image} alt="" className="h-full w-full object-cover" />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-8 md:p-10">
                        <h3 className="text-3xl font-bold uppercase tracking-wide text-white md:text-5xl">
                          {dish.name}
                        </h3>
                        <p className="mt-3 text-lg text-[#FF8A2A]">
                          {promptFor(dish)}
                        </p>
                        <div className="mt-3 text-3xl font-bold text-white">
                          {pounds(dish.price, dish.currency)}
                        </div>
                        {center && (
                          <button
                            type="button"
                            onClick={() => open(dish)}
                            className="mt-6 rounded-xl bg-[#ff8c00] px-8 py-3 font-bold uppercase tracking-wider text-black hover:bg-[#ff9500]"
                          >
                            Add to order
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Next dish"
              onClick={() => go(index + 1)}
              className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white md:flex"
            >
              ›
            </button>
          </div>
        )}
        {count > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {visible.map((dish, dot) => (
              <button
                key={dish.id}
                type="button"
                aria-label={`Show ${dish.name}`}
                onClick={() => setIndex(dot)}
                className={`h-2 rounded-full ${dot === index ? "w-8 bg-[#FF8A2A]" : "w-2 bg-gray-600"}`}
              />
            ))}
          </div>
        )}
      </div>
      {pending && <DishPicker dish={pending} onClose={() => setPending(null)} />}
      {showCart && cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(560px,calc(100%-2rem))] -translate-x-1/2">
          <Link
            href="/order"
            className="flex items-center justify-between rounded-full bg-[#ff8c00] px-6 py-4 font-bold text-black shadow-[0_10px_30px_rgba(255,140,0,0.3)]"
          >
            <span>
              {cartCount} {cartCount === 1 ? "dish" : "dishes"}
            </span>
            <span>Checkout {pounds(cartTotal, currency)}</span>
          </Link>
        </div>
      )}
    </section>
  );
}

function promptFor(dish: WebDish) {
  if ((dish.cook_options || []).length) return "Choose how it's cooked";
  if (["free", "paid", "mixed"].includes(dish.side_mode)) return "Comes with a choice of side";
  if ((dish.addon_groups || []).length || (dish.modifiers || []).length) return "Choose your extras";
  return dish.category;
}
