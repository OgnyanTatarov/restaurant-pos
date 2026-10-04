"use client";

import { useState, type ReactNode } from "react";
import { addToCart } from "../../lib/cart";
import { pounds, type WebDish } from "../../lib/restaurant";

export default function DishPicker({
  dish,
  onClose,
}: {
  dish: WebDish;
  onClose: () => void;
}) {
  const cooks = dish.cook_options || [];
  const needsSide = ["free", "paid", "mixed"].includes(dish.side_mode);
  const sides = dish.sides || [];
  const included = sides.filter((side) => !side.price);
  const paid = sides.filter((side) => side.price);
  const leaveouts = (dish.modifiers || []).filter((mod) => mod.kind === "leaveout");
  const groups = (dish.addon_groups || []).filter((group) => (group.extras || []).length);
  const [qty, setQty] = useState(1);
  const [cookId, setCookId] = useState(cooks.length === 1 ? cooks[0].id : "");
  const [sideId, setSideId] = useState(sides.length === 1 ? sides[0].id : "");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [leaveoutIds, setLeaveoutIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const side = sides.find((option) => option.id === sideId);
  const sidePrice = dish.side_mode === "free" ? 0 : side?.price || 0;
  const extraTotal = groups
    .flatMap((group) => group.extras)
    .filter((extra) => extraIds.includes(extra.id))
    .reduce((sum, extra) => sum + (extra.price || 0), 0);

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function save() {
    if (cooks.length && !cookId) {
      setError("Choose how it's cooked");
      return;
    }
    if (needsSide && !sideId) {
      setError("Choose a side");
      return;
    }
    const cook = cooks.find((option) => option.id === cookId);
    addToCart({
      menuId: dish.id,
      name: dish.name,
      price: dish.price,
      qty,
      cookId: cook?.id || "",
      cookName: cook?.name || "",
      sideId: side?.id || "",
      sideName: side?.name || "",
      sidePrice,
      extras: groups
        .flatMap((group) => group.extras)
        .filter((extra) => extraIds.includes(extra.id))
        .map((extra) => ({ id: extra.id, name: extra.name, price: extra.price || 0 })),
      leaveouts: leaveouts
        .filter((mod) => leaveoutIds.includes(mod.id))
        .map((mod) => ({ id: mod.id, name: mod.name })),
      note,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-3xl font-black uppercase tracking-wide text-white">{dish.name}</h3>
            <p className="mt-2 text-2xl font-bold text-[#ff8c00]">
              {pounds(dish.price + sidePrice + extraTotal, dish.currency)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-white">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="h-10 w-10 rounded-full border border-white/20">−</button>
            <strong>{qty}</strong>
            <button type="button" onClick={() => setQty(Math.min(20, qty + 1))} className="h-10 w-10 rounded-full border border-white/20">+</button>
          </div>
        </div>
        {cooks.length > 0 && (
          <ChoiceGroup title="How it's cooked" hint="Pick one">
            {cooks.map((option) => (
              <Chip key={option.id} selected={cookId === option.id} onClick={() => setCookId(option.id)}>
                {option.name}
              </Chip>
            ))}
          </ChoiceGroup>
        )}
        {needsSide && (
          <ChoiceGroup title="Side" hint="Pick one">
            {(dish.side_mode === "mixed" ? included : sides).map((option) => (
              <Chip key={option.id} selected={sideId === option.id} onClick={() => setSideId(option.id)}>
                {option.name}
                {dish.side_mode !== "free" && option.price
                  ? ` · ${pounds(option.price, dish.currency)}`
                  : dish.side_mode !== "free"
                    ? " · Included"
                    : ""}
              </Chip>
            ))}
            {dish.side_mode === "mixed" &&
              paid.map((option) => (
                <Chip key={option.id} selected={sideId === option.id} onClick={() => setSideId(option.id)}>
                  {option.name} · {pounds(option.price, dish.currency)}
                </Chip>
              ))}
          </ChoiceGroup>
        )}
        {leaveouts.length > 0 && (
          <ChoiceGroup title="Leave out" hint="Optional">
            {leaveouts.map((option) => (
              <Chip
                key={option.id}
                selected={leaveoutIds.includes(option.id)}
                onClick={() => toggle(leaveoutIds, option.id, setLeaveoutIds)}
              >
                No {option.name}
              </Chip>
            ))}
          </ChoiceGroup>
        )}
        {groups.map((group) => (
          <ChoiceGroup key={group.id} title={group.name} hint="Optional">
            {group.extras.map((option) => (
              <Chip
                key={option.id}
                selected={extraIds.includes(option.id)}
                onClick={() => toggle(extraIds, option.id, setExtraIds)}
              >
                {option.name}
                {option.price ? ` · ${pounds(option.price, dish.currency)}` : ""}
              </Chip>
            ))}
          </ChoiceGroup>
        ))}
        <label className="mt-6 block text-sm uppercase tracking-wider text-[#cccccc]">
          Note
          <textarea
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-base normal-case tracking-normal text-white"
          />
        </label>
        {error && <p className="mt-4 text-[#ff8c00]">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={save} className="flex-1 rounded-xl bg-[#ff8c00] py-4 font-bold text-black">
            Add to order
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/20 px-5 py-4 text-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="mt-6">
      <legend className="flex items-baseline gap-3 text-sm font-bold uppercase tracking-wider text-white">
        {title}
        <span className="font-medium text-[#888]">{hint}</span>
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm ${
        selected
          ? "border-[#ff8c00] bg-[#ff8c00] text-black"
          : "border-white/20 text-white hover:border-[#ff8c00]"
      }`}
    >
      {children}
    </button>
  );
}
