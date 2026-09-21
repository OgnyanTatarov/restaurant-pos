import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { PosError } from "../core/engine.mjs";
const updateName = (url) => {
  const name = decodeURIComponent((url || "").split("?")[0].replace(/^\/updates\//, ""));
  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,160}\.(yml|yaml|exe|zip|blockmap)$/.test(
      name,
    )
  )
    return null;
  return name;
};
export function createHub(
  engine,
  {
    port = 47831,
    host = "0.0.0.0",
    tlsCert,
    tlsKey,
    printers,
    updatesDir,
    execute,
  } = {},
) {
  const handler = async (req, res) => {
    const allowed = [
      "capacitor://localhost",
      "http://localhost",
      "https://localhost",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
    if (allowed.includes(req.headers.origin)) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/updates/")) {
      const name = updateName(req.url);
      const file =
        updatesDir && name ? path.resolve(updatesDir, name) : "";
      const root = updatesDir ? path.resolve(updatesDir) + path.sep : "";
      if (!file || !file.startsWith(root) || !fs.existsSync(file)) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Update file not found" }));
        return;
      }
      const types = {
        yml: "text/yaml",
        yaml: "text/yaml",
        exe: "application/octet-stream",
        zip: "application/zip",
        blockmap: "application/octet-stream",
      };
      const ext = name.slice(name.lastIndexOf(".") + 1);
      res.setHeader("Content-Type", types[ext] || "application/octet-stream");
      res.setHeader("Content-Length", fs.statSync(file).size);
      fs.createReadStream(file).pipe(res);
      return;
    }
    try {
      const actor = engine.authenticate(
        req.headers.authorization?.replace(/^Bearer /, ""),
      );
      if (!actor)
        throw new PosError("Pair this device with the desktop first", 401);
      if (req.url === "/api/state" && req.method === "GET") {
        res.end(
          JSON.stringify({
            state: engine.snapshot(),
            actor,
            printers:
              typeof printers === "function"
                ? printers()
                : printers || { named: [], kitchen: "", bar: "", bill: "" },
          }),
        );
        return;
      }
      if (req.url === "/api/command" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 65536)
            throw new PosError("Request too large", 413);
        }
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new PosError("Invalid JSON");
        }
        const result = await (execute || ((c, a) => engine.execute(c, a)))(
          parsed,
          actor,
        );
        res.end(JSON.stringify(result));
        return;
      }
      throw new PosError("Not found", 404);
    } catch (e) {
      res.writeHead(e.status || 500);
      res.end(
        JSON.stringify({
          error: e.status ? e.message : "Internal server error",
        }),
      );
    }
  };
  const server =
    tlsCert && tlsKey
      ? https.createServer(
          { cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) },
          handler,
        )
      : http.createServer(handler);
  server.requestTimeout = 30 * 60 * 1000;
  server.headersTimeout = 60000;
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
