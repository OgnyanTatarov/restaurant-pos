import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type {
  State,
  Actor,
  Connection,
  Command,
  PrinterAssignments,
} from "./types";
export const desktop = !!window.posDesktop;
export const native = Capacitor.isNativePlatform();
if (native) document.documentElement.classList.add("native");
export const emptyConnection: Connection = {
  mode: "lan",
  url: "",
  token: "",
  key: "",
  restaurantId: "",
};
export let connection: Connection =
  JSON.parse(localStorage.getItem("pos.connection") || "null") ||
  emptyConnection;
let accessToken = "",
  refreshToken = "",
  expiresAt = 0;
export function configure(c: Connection) {
  if (c.mode === "cloud" && !c.url.startsWith("https://"))
    throw Error("Supabase requires an HTTPS project URL");
  const changed = JSON.stringify(connection) !== JSON.stringify(c);
  connection = { ...c, url: c.url.replace(/\/$/, "") };
  localStorage.setItem("pos.connection", JSON.stringify(connection));
  if (changed) {
    localStorage.removeItem("pos.cache");
    localStorage.removeItem("pos.pending");
  }
  accessToken = "";
  refreshToken = "";
  expiresAt = 0;
}
export async function ipc(name: string, ...args: any[]) {
  const r = await window.posDesktop![name](...args);
  if (!r.ok) throw Error(r.error);
  return r.data;
}
async function request(
  url: string,
  method = "GET",
  data?: any,
  headers: Record<string, string> = {},
) {
  const all = { "Content-Type": "application/json", ...headers };
  let status: number, body: any;
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.request({
      url,
      method,
      headers: all,
      data,
      connectTimeout: 10000,
      readTimeout: 15000,
    });
    status = r.status;
    body = r.data;
  } else {
    const r = await fetch(url, {
      method,
      headers: all,
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });
    status = r.status;
    body = await r.json();
  }
  if (status >= 400) {
    const e = new Error(
      body?.error_description ||
        body?.message ||
        body?.error ||
        `Request failed (${status})`,
    );
    (e as any).status = status;
    throw e;
  }
  return body;
}
export async function login(email: string, password: string) {
  const d = await request(
    connection.url + "/auth/v1/token?grant_type=password",
    "POST",
    { email, password },
    { apikey: connection.key },
  );
  accessToken = d.access_token;
  refreshToken = d.refresh_token;
  expiresAt = Date.now() + d.expires_in * 1000;
}
async function headers() {
  if (!accessToken) throw Error("Sign in to Supabase on this device");
  if (Date.now() > expiresAt - 60000) {
    const d = await request(
      connection.url + "/auth/v1/token?grant_type=refresh_token",
      "POST",
      { refresh_token: refreshToken },
      { apikey: connection.key },
    );
    accessToken = d.access_token;
    refreshToken = d.refresh_token;
    expiresAt = Date.now() + d.expires_in * 1000;
  }
  return { apikey: connection.key, Authorization: `Bearer ${accessToken}` };
}
export const emptyPrinters: PrinterAssignments = {
  named: [],
  kitchen: "",
  bar: "",
  bill: "",
};
export async function getState(): Promise<{
  state: State;
  actor: Actor;
  printers: PrinterAssignments;
}> {
  let result;
  if (desktop) result = await ipc("state");
  else if (connection.mode === "lan")
    result = await request(connection.url + "/api/state", "GET", undefined, {
      Authorization: `Bearer ${connection.token}`,
    });
  else {
    const h = await headers();
    const rows = await request(
      `${connection.url}/rest/v1/pos_snapshots?restaurant_id=eq.${encodeURIComponent(connection.restaurantId)}&select=state,updated_at`,
      "GET",
      undefined,
      h,
    );
    if (!rows.length)
      throw Error("No cloud snapshot yet. Check the Windows Supabase setup.");
    const members = await request(
      `${connection.url}/rest/v1/pos_members?restaurant_id=eq.${encodeURIComponent(connection.restaurantId)}&select=user_id,display_name,role`,
      "GET",
      undefined,
      h,
    );
    if (!members.length) throw Error("Restaurant membership is missing");
    result = {
      state: rows[0].state,
      actor: {
        id: members[0].user_id,
        name: members[0].display_name,
        role: members[0].role,
      },
    };
  }
  const printers =
    result.printers && Array.isArray(result.printers.named)
      ? result.printers
      : emptyPrinters;
  const next = { ...result, printers };
  if (!desktop) localStorage.setItem("pos.cache", JSON.stringify(next));
  return next;
}
export function cached(): { state: State; actor: Actor } | null {
  try {
    return JSON.parse(localStorage.getItem("pos.cache") || "null");
  } catch {
    return null;
  }
}
export function pending(): Command | null {
  try {
    return JSON.parse(localStorage.getItem("pos.pending") || "null");
  } catch {
    return null;
  }
}
export async function submit(
  type: string,
  payload: Record<string, unknown>,
  retry?: Command,
): Promise<any> {
  const c = retry || { id: crypto.randomUUID(), type, payload };
  if (!desktop) {
    if (pending() && !retry)
      throw Error("Resolve the pending action before making another change.");
    localStorage.setItem("pos.pending", JSON.stringify(c));
  }
  try {
    let result;
    if (desktop) result = await ipc("command", c);
    else if (connection.mode === "lan")
      result = await request(connection.url + "/api/command", "POST", c, {
        Authorization: `Bearer ${connection.token}`,
      });
    else {
      const h = await headers();
      await request(
        connection.url + "/rest/v1/rpc/pos_submit_command",
        "POST",
        {
          p_id: c.id,
          p_restaurant: connection.restaurantId,
          p_command: { type: c.type, payload: c.payload },
        },
        h,
      );
      for (let n = 0; n < 15; n++) {
        const rows = await request(
          `${connection.url}/rest/v1/pos_commands?id=eq.${c.id}&select=status,result`,
          "GET",
          undefined,
          h,
        );
        if (rows[0]?.status === "error") {
          const e = new Error(rows[0].result.error);
          (e as any).status = 400;
          (e as any).definitive = true;
          throw e;
        }
        if (rows[0]?.status === "done") {
          result = rows[0].result;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!result)
        throw Error(
          "Waiting for the Windows hub. Retry this same action once it reconnects.",
        );
    }
    localStorage.removeItem("pos.pending");
    return result;
  } catch (e) {
    if (
      (e as any).definitive ||
      (connection.mode === "lan" &&
        (e as any).status >= 400 &&
        (e as any).status < 500)
    )
      localStorage.removeItem("pos.pending");
    throw e;
  }
}
