import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { bakedSupabase, applyBakedSupabase } = createRequire(import.meta.url)(
  "../desktop/config.cjs",
);
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.test";
test("installation writes baked restaurant settings when the till has none", () => {
  const dir = mkdtempSync(join(tmpdir(), "pos-config-"));
  try {
    writeFileSync(
      join(dir, "supabase.json"),
      JSON.stringify({
        url: "https://nebpmyoglgmaztexbchl.supabase.co",
        restaurantId: "2fa67e09-df28-4be7-a90d-03dab6436936",
      }),
    );
    writeFileSync(
      join(dir, "supabase.local.json"),
      JSON.stringify({ serviceRoleKey: key }),
    );
    const baked = bakedSupabase(dir, {});
    const next = applyBakedSupabase({ port: 47831, printers: {} }, baked);
    assert.equal(next.changed, true);
    assert.equal(next.config.supabase.url, baked.url);
    assert.equal(next.config.supabase.serviceRoleKey, key);
    assert.equal(
      applyBakedSupabase(next.config, baked).changed,
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("a placeholder key is replaced; a real till config is left alone", () => {
  const baked = {
    url: "https://nebpmyoglgmaztexbchl.supabase.co",
    restaurantId: "2fa67e09-df28-4be7-a90d-03dab6436936",
    serviceRoleKey: key,
  };
  const placeholder = applyBakedSupabase(
    {
      supabase: {
        url: baked.url,
        restaurantId: baked.restaurantId,
        serviceRoleKey: "YOUR_SERVER_ONLY_SERVICE_ROLE_KEY",
      },
    },
    baked,
  );
  assert.equal(placeholder.changed, true);
  assert.equal(placeholder.config.supabase.serviceRoleKey, key);
  const custom = {
    url: "https://other.supabase.co",
    restaurantId: "11111111-1111-1111-1111-111111111111",
    serviceRoleKey: "real-custom-key",
  };
  assert.equal(applyBakedSupabase({ supabase: custom }, baked).changed, false);
});
