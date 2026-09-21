const fs = require("node:fs");
const path = require("node:path");

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
};

const placeholderKey = (key) =>
  !key || /YOUR_|PLACEHOLDER|CHANGE_ME/i.test(String(key));

const complete = (supabase) =>
  !!(
    supabase?.url &&
    supabase?.restaurantId &&
    !placeholderKey(supabase.serviceRoleKey)
  );

function bakedSupabase(dir = __dirname, env = process.env) {
  const pub = readJson(path.join(dir, "supabase.json"));
  const local = readJson(path.join(dir, "supabase.local.json"));
  const supabase = {
    url: pub.url || local.url || "",
    restaurantId: pub.restaurantId || local.restaurantId || "",
    serviceRoleKey:
      env.POS_SUPABASE_SERVICE_ROLE_KEY ||
      local.serviceRoleKey ||
      pub.serviceRoleKey ||
      "",
  };
  return complete(supabase) ? supabase : null;
}

function applyBakedSupabase(config, baked) {
  if (!baked || complete(config?.supabase))
    return { config, changed: false };
  return { config: { ...config, supabase: baked }, changed: true };
}

module.exports = { bakedSupabase, applyBakedSupabase, complete };
