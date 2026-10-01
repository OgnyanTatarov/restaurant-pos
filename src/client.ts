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
export const cloudProject = {
  url: "https://nebpmyoglgmaztexbchl.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYnBteW9nbGdtYXp0ZXhiY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTM1OTcsImV4cCI6MjEwNTM4OTU5N30.SZ0AMht0MDPhNjrbx-ZH8yt8jTC4_ck1LAzA0TL4xn4",
  restaurantId: "2fa67e09-df28-4be7-a90d-03dab6436936",
};
export class SignInRequired extends Error {
  code = "signin";
  constructor() {
    super("Sign in to use the till away from the restaurant.");
  }
}
export const emptyConnection: Connection = {
  mode: "cloud",
  url: cloudProject.url,
  token: "",
  key: cloudProject.key,
  restaurantId: cloudProject.restaurantId,
};
export let connection: Connection =
  JSON.parse(localStorage.getItem("pos.connection") || "null") ||
  emptyConnection;
let accessToken = "",
  refreshToken = "",
  expiresAt = 0;
try {
  const saved = JSON.parse(localStorage.getItem("pos.session") || "null");
  if (saved?.refresh) {
    accessToken = saved.access || "";
    refreshToken = saved.refresh;
    expiresAt = saved.expiresAt || 0;
  }
} catch {
  /* a damaged session just asks for sign-in again */
}
function saveSession(d: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  accessToken = d.access_token;
  refreshToken = d.refresh_token;
  expiresAt = Date.now() + d.expires_in * 1000;
  localStorage.setItem(
    "pos.session",
    JSON.stringify({
      access: accessToken,
      refresh: refreshToken,
      expiresAt,
    }),
  );
}
function clearSession() {
  accessToken = "";
  refreshToken = "";
  expiresAt = 0;
  localStorage.removeItem("pos.session");
}
function cloudTarget() {
  if (
    connection.mode === "cloud" &&
    connection.url &&
    connection.key &&
    connection.restaurantId
  )
    return connection;
  return {
    ...connection,
    mode: "cloud" as const,
    url: cloudProject.url,
    key: cloudProject.key,
    restaurantId: cloudProject.restaurantId,
  };
}
export function configure(c: Connection) {
  if (c.mode === "cloud" && !c.url.startsWith("https://"))
    throw Error("Supabase requires an HTTPS project URL");
  const next = { ...c, url: c.url.replace(/\/$/, "") };
  const changed = JSON.stringify(connection) !== JSON.stringify(next);
  const sameCloud =
    connection.mode === "cloud" &&
    next.mode === "cloud" &&
    connection.url === next.url &&
    connection.restaurantId === next.restaurantId;
  connection = next;
  localStorage.setItem("pos.connection", JSON.stringify(connection));
  if (changed) {
    localStorage.removeItem("pos.cache");
    localStorage.removeItem("pos.pending");
  }
  if (!sameCloud) clearSession();
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
  timeout = 12000,
) {
  const all = { "Content-Type": "application/json", ...headers };
  let status: number, body: any;
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.request({
      url,
      method,
      headers: all,
      data,
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    status = r.status;
    body = r.data;
  } else {
    const r = await fetch(url, {
      method,
      headers: all,
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(timeout),
    });
    status = r.status;
    body = await r.json();
  }
  if (!status || status >= 400) {
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
export function signedIn() {
  return !!refreshToken;
}
export async function login(email: string, password: string) {
  const d = await request(
    connection.url + "/auth/v1/token?grant_type=password",
    "POST",
    { email, password },
    { apikey: connection.key },
  );
  saveSession(d);
}
async function authHeaders(target = cloudTarget()) {
  if (!refreshToken) throw new SignInRequired();
  if (!accessToken || Date.now() > expiresAt - 60000) {
    const d = await request(
      target.url + "/auth/v1/token?grant_type=refresh_token",
      "POST",
      { refresh_token: refreshToken },
      { apikey: target.key },
    );
    saveSession(d);
  }
  return { apikey: target.key, Authorization: `Bearer ${accessToken}` };
}
export const emptyPrinters: PrinterAssignments = {
  named: [],
  kitchen: "",
  bar: "",
  bill: "",
};
async function readLan() {
  return request(
    connection.url + "/api/state",
    "GET",
    undefined,
    { Authorization: `Bearer ${connection.token}` },
    4000,
  );
}
async function readCloud() {
  const target = cloudTarget();
  const h = await authHeaders(target);
  const rows = await request(
    `${target.url}/rest/v1/pos_snapshots?restaurant_id=eq.${encodeURIComponent(target.restaurantId)}&select=state,updated_at`,
    "GET",
    undefined,
    h,
  );
  if (!rows.length)
    throw Error(
      "No cloud snapshot yet. Keep the Windows till open and online once so it can publish the restaurant.",
    );
  const members = await request(
    `${target.url}/rest/v1/pos_members?restaurant_id=eq.${encodeURIComponent(target.restaurantId)}&select=user_id,display_name,role`,
    "GET",
    undefined,
    h,
  );
  if (!members.length) throw Error("Restaurant membership is missing");
  return {
    state: rows[0].state,
    actor: {
      id: members[0].user_id,
      name: members[0].display_name,
      role: members[0].role,
    },
  };
}
const unreachable = (e: any) => !e?.status;
export async function getState(): Promise<{
  state: State;
  actor: Actor;
  printers: PrinterAssignments;
}> {
  let result;
  if (desktop) result = await ipc("state");
  else if (connection.mode === "lan" && connection.url) {
    try {
      result = await readLan();
    } catch (e) {
      if (!unreachable(e)) throw e;
      result = await readCloud();
    }
  } else result = await readCloud();
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
    else {
      const sendCloud = async () => {
        const target = cloudTarget();
        const h = await authHeaders(target);
        await request(
          target.url + "/rest/v1/rpc/pos_submit_command",
          "POST",
          {
            p_id: c.id,
            p_restaurant: target.restaurantId,
            p_command: { type: c.type, payload: c.payload },
          },
          h,
        );
        for (let n = 0; n < 20; n++) {
          const rows = await request(
            `${target.url}/rest/v1/pos_commands?id=eq.${c.id}&select=status,result`,
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
          if (rows[0]?.status === "done") return rows[0].result;
          await new Promise((r) => setTimeout(r, 1000));
        }
        throw Error(
          "The restaurant till is offline. The order is saved and can be retried when that computer is back online.",
        );
      };
      if (connection.mode === "lan" && connection.url) {
        try {
          result = await request(
            connection.url + "/api/command",
            "POST",
            c,
            { Authorization: `Bearer ${connection.token}` },
            4000,
          );
        } catch (e) {
          if (!unreachable(e)) throw e;
          result = await sendCloud();
        }
      } else result = await sendCloud();
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
