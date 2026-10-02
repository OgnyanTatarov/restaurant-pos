const live = (rows) => (Array.isArray(rows) ? rows.filter((row) => row && !row.deleted) : []);

const sideModeOf = (item, category) => {
  if (["none", "free", "paid", "mixed"].includes(item?.sideMode))
    return item.sideMode;
  return category?.sideMode && category.sideMode !== "none"
    ? category.sideMode
    : "none";
};

export function websiteMenuRows(state, restaurantId, updatedAt = new Date().toISOString()) {
  const categories = live(state?.categories);
  const order = new Map(categories.map((category, index) => [category.name, index]));
  return live(state?.menu).map((item, index) => {
    const category = categories.find((entry) => entry.name === item.category);
    return {
      restaurant_id: restaurantId,
      id: item.id,
      name: item.name,
      category: item.category || "",
      category_sort: order.get(item.category) ?? categories.length,
      price: item.price,
      currency: state.settings?.currency || "EUR",
      station: item.station === "bar" ? "bar" : "kitchen",
      available: item.available !== false,
      image: typeof item.image === "string" ? item.image : "",
      modifiers: live(item.modifiers).map((mod) => ({
        id: mod.id,
        name: mod.name,
        kind: mod.kind,
        price: mod.price || 0,
      })),
      addon_groups: live(item.addonGroups).map((group) => ({
        id: group.id,
        name: group.name,
        extras: live(group.extras).map((extra) => ({
          id: extra.id,
          name: extra.name,
          price: extra.price || 0,
        })),
      })),
      cook_options: live(item.cookOptions).map((cook) => ({
        id: cook.id,
        name: cook.name,
      })),
      side_mode: sideModeOf(item, category),
      sides: live(category?.sides).map((side) => ({
        id: side.id,
        name: side.name,
        price: side.price || 0,
      })),
      sort_order: index,
      updated_at: updatedAt,
    };
  });
}

export function menuFromWebsiteRows(rows) {
  const sorted = [...(rows || [])].sort(
    (a, b) =>
      (a.category_sort || 0) - (b.category_sort || 0) ||
      (a.sort_order || 0) - (b.sort_order || 0),
  );
  const categories = [];
  for (const row of sorted) {
    if (categories.some((category) => category.name === row.category)) continue;
    categories.push({
      id: crypto.randomUUID(),
      name: row.category,
      deleted: false,
      sideMode: "none",
      sides: [],
    });
  }
  const menu = sorted.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    category: row.category,
    station: row.station === "bar" ? "bar" : "kitchen",
    available: row.available !== false,
    deleted: false,
    image: row.image || "",
    modifiers: row.modifiers || [],
    addonGroups: row.addon_groups || [],
    cookOptions: row.cook_options || [],
    sideMode: row.side_mode || "inherit",
  }));
  return { categories, menu };
}
