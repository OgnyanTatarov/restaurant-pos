export const restaurant = {
  url: "https://nebpmyoglgmaztexbchl.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYnBteW9nbGdtYXp0ZXhiY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTM1OTcsImV4cCI6MjEwNTM4OTU5N30.SZ0AMht0MDPhNjrbx-ZH8yt8jTC4_ck1LAzA0TL4xn4",
  id: "2fa67e09-df28-4be7-a90d-03dab6436936",
};

export type CookOption = { id: string; name: string };
export type SideOption = { id: string; name: string; price: number };
export type ExtraOption = { id: string; name: string; price: number };
export type AddonGroup = { id: string; name: string; extras: ExtraOption[] };
export type LeaveOption = { id: string; name: string; kind?: string };
export type WebDish = {
  id: string;
  name: string;
  category: string;
  category_sort: number;
  price: number;
  currency: string;
  station: string;
  image: string;
  cook_options: CookOption[];
  side_mode: string;
  sides: SideOption[];
  modifiers: LeaveOption[];
  addon_groups: AddonGroup[];
  sort_order: number;
};

export function pounds(minor: number, currency = "GBP") {
  const amount = (Number(minor) / 100).toFixed(2);
  if (currency === "GBP") return `£${amount}`;
  if (currency === "EUR") return `€${amount}`;
  if (currency === "USD") return `$${amount}`;
  return `${currency} ${amount}`;
}

export function needsChoice(dish: WebDish) {
  return (
    (dish.cook_options || []).length > 0 ||
    ["free", "paid", "mixed"].includes(dish.side_mode) ||
    (dish.modifiers || []).some((mod) => mod.kind === "leaveout") ||
    (dish.addon_groups || []).some((group) => (group.extras || []).length > 0)
  );
}

const headers = {
  apikey: restaurant.key,
  Authorization: `Bearer ${restaurant.key}`,
};

export async function loadMenu(): Promise<WebDish[]> {
  const url =
    `${restaurant.url}/rest/v1/pos_menu_items` +
    `?restaurant_id=eq.${restaurant.id}&available=eq.true` +
    `&select=id,name,category,category_sort,price,currency,station,image,cook_options,side_mode,sides,modifiers,addon_groups,sort_order` +
    `&order=category_sort.asc,sort_order.asc`;
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) throw new Error("The menu is unavailable right now");
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

export async function placeOrder(order: {
  name: string;
  phone: string;
  note: string;
  fulfilment: "collection" | "delivery";
  address: string;
  items: {
    menuId: string;
    qty: number;
    cookId?: string;
    sideId?: string;
    extraIds?: string[];
    leaveoutIds?: string[];
    note?: string;
  }[];
}) {
  const response = await fetch(
    `${restaurant.url}/rest/v1/rpc/pos_place_web_order`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_restaurant: restaurant.id,
        p_customer_name: order.name,
        p_phone: order.phone,
        p_note: order.note,
        p_fulfilment: order.fulfilment,
        p_address: order.address,
        p_items: order.items,
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || "The order could not be placed");
  }
  return payload as { id: string; total: number };
}
