"use client";

import Link from "next/link";
import { useCart } from "../../lib/cart";

export default function OrderLink({
  prominent = false,
}: {
  prominent?: boolean;
}) {
  const lines = useCart();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const className = prominent
    ? "bg-[#ff8c00] text-black px-4 sm:px-6 md:px-8 py-2 md:py-3 text-xs sm:text-sm font-bold tracking-wide rounded hover:bg-[#ff9500] hover:-translate-y-0.5 transition-all whitespace-nowrap"
    : "text-white text-xs sm:text-sm tracking-wide hover:text-[#ff8c00] transition-colors whitespace-nowrap";
  return (
    <Link href="/order" className={className}>
      {prominent ? "ORDER ONLINE" : `Order${count ? ` (${count})` : ""}`}
    </Link>
  );
}
