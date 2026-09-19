// Development / integration hub. Production printing runs inside Electron.
import { Engine } from "../core/engine.mjs";
import { createHub } from "./hub.mjs";
import fs from "node:fs";
const engine = new Engine(process.env.POS_DATABASE || "restaurant.sqlite");
const credentials = engine.pair("Development client", "manager");
fs.writeFileSync(".dev-pairing.json", JSON.stringify(credentials, null, 2), {
  mode: 0o600,
});
const server = await createHub(engine, {
  port: Number(process.env.POS_PORT || 47831),
  host: "127.0.0.1",
});
console.log(
  "Development hub ready. Pairing token saved in .dev-pairing.json. No printer service in this mode.",
);
process.on("SIGINT", () =>
  server.close(() => {
    engine.close();
    process.exit();
  }),
);
