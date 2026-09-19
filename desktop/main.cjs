const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  powerSaveBlocker,
} = require("electron");
const path = require("node:path"),
  fs = require("node:fs"),
  os = require("node:os");
let win,
  engine,
  hub,
  stopCloud,
  printTimer,
  printing = false,
  cloudStatus = {},
  hubError = "";
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const { Engine } = await import("../core/engine.mjs");
      const { createHub } = await import("./hub.mjs");
      const { startCloud } = await import("./cloud.mjs");
      const { ticketHtml, billHtml } = await import("./ticket.mjs");
      const {
        normalizePrinters,
        publicPrinters,
        deviceForJob,
      } = await import("./printers.mjs");
      const data = app.getPath("userData");
      fs.mkdirSync(data, { recursive: true });
      engine = new Engine(path.join(data, "restaurant.sqlite"));
      const configPath = path.join(data, "desktop-config.json");
      let config = {
        printers: { named: [], kitchen: "", bar: "", bill: "" },
        port: 47831,
      };
      if (fs.existsSync(configPath)) {
        try {
          config = {
            ...config,
            ...JSON.parse(fs.readFileSync(configPath, "utf8")),
          };
        } catch {
          dialog.showErrorBox(
            "Configuration error",
            "desktop-config.json is not valid JSON. Correct it and restart.",
          );
          app.quit();
          return;
        }
      }
      config.printers = normalizePrinters(config.printers);
      const { parseUpdateFeed, createUpdater } = require("./updater.cjs");
      let bakedFeed = {};
      try {
        bakedFeed = JSON.parse(
          fs.readFileSync(path.join(__dirname, "update-feed.json"), "utf8"),
        );
      } catch {
        bakedFeed = {};
      }
      const updatesDir = path.join(data, "updates");
      fs.mkdirSync(updatesDir, { recursive: true });
      const localUpdateUrl = () =>
        `${config.tlsCert ? "https" : "http"}://127.0.0.1:${config.port}/updates/`;
      const resolveFeed = () =>
        parseUpdateFeed(config.updateUrl) ||
        parseUpdateFeed(bakedFeed) ||
        parseUpdateFeed(localUpdateUrl());
      const updater = createUpdater({
        app,
        getFeed: resolveFeed,
      });
      try {
        hub = await createHub(engine, {
          port: config.port,
          tlsCert: config.tlsCert,
          tlsKey: config.tlsKey,
          printers: () => publicPrinters(config.printers),
          updatesDir,
        });
      } catch (e) {
        hubError = e.message;
      }
      stopCloud = startCloud(engine, config.supabase, (s) => (cloudStatus = s));
      win = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 900,
        minHeight: 650,
        title: "Restaurant POS",
        backgroundColor: "#f3f5f4",
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      win.setMenuBarVisibility(false);
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e) => e.preventDefault());
      const handle = (name, fn) =>
        ipcMain.handle(name, async (event, ...args) => {
          if (event.sender !== win.webContents) throw Error("Access denied");
          try {
            return { ok: true, data: await fn(...args) };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        });
      const saveConfig = () => {
        fs.writeFileSync(configPath + ".tmp", JSON.stringify(config, null, 2), {
          mode: 0o600,
        });
        fs.renameSync(configPath + ".tmp", configPath);
      };
      const print = async (job) => {
        const deviceName = deviceForJob(config.printers, job);
        const printers = await win.webContents.getPrintersAsync();
        if (!printers.some((p) => p.name === deviceName))
          throw Error(`Printer unavailable: ${deviceName}`);
        const sheet = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            contextIsolation: true,
          },
        });
        try {
          await sheet.loadURL(
            "data:text/html;charset=utf-8," +
              encodeURIComponent(
                (job.station === "bill" ? billHtml : ticketHtml)(
                  job,
                  engine.state.settings,
                ),
              ),
          );
          await new Promise((resolve, reject) =>
            sheet.webContents.print(
              {
                silent: true,
                deviceName,
                printBackground: false,
                margins: { marginType: "none" },
              },
              (ok, reason) =>
                ok
                  ? resolve()
                  : reject(Error(reason || "Printer rejected job")),
            ),
          );
        } finally {
          sheet.destroy();
        }
      };
      handle("pos:state", () => ({
        state: engine.snapshot(),
        actor: { id: "desktop", name: "Desktop manager", role: "manager" },
        printers: publicPrinters(config.printers),
      }));
      handle("pos:command", (c) => engine.execute(c));
      handle("pos:info", () => ({
        addresses: Object.values(os.networkInterfaces())
          .flat()
          .filter((x) => x && x.family === "IPv4" && !x.internal)
          .map(
            (x) =>
              `${config.tlsCert ? "https" : "http"}://${x.address}:${config.port}`,
          ),
        devices: engine.devices(),
        printers: config.printers,
        dataPath: data,
        cloud: cloudStatus,
        hubError,
        version: app.getVersion(),
        update: updater.status(),
        updateUrl: config.updateUrl || bakedFeed.url || "",
        updateFolder: updatesDir,
        updateShare:
          Object.values(os.networkInterfaces())
            .flat()
            .filter((x) => x && x.family === "IPv4" && !x.internal)
            .map(
              (x) =>
                `${config.tlsCert ? "https" : "http"}://${x.address}:${config.port}/updates/`,
            )[0] ||
          localUpdateUrl(),
      }));
      handle("pos:save-update-url", (url) => {
        if (url && !parseUpdateFeed(url))
          throw Error(
            "Use an http(s) folder URL, or github:owner/repo",
          );
        config.updateUrl = String(url || "").trim();
        saveConfig();
        return { updateUrl: config.updateUrl };
      });
      handle("pos:check-update", () => updater.check());
      handle("pos:install-update", () => updater.install());
      handle("pos:printers", () => win.webContents.getPrintersAsync());
      handle("pos:save-printers", (p) => {
        config.printers = normalizePrinters(p);
        saveConfig();
        return publicPrinters(config.printers);
      });
      handle("pos:pair", (p) => engine.pair(p.name, p.role));
      handle("pos:revoke", (id) => engine.revoke(id));
      handle("pos:backup", async () => {
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
          defaultPath: `restaurant-backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
          filters: [{ name: "SQLite backup", extensions: ["sqlite"] }],
        });
        if (canceled) return null;
        const { backup } = await import("node:sqlite");
        await backup(engine.db, filePath);
        return filePath;
      });
      handle("pos:test-print", async (station) => {
        if (!["kitchen", "bar", "bill"].includes(station))
          throw Error("Invalid station");
        await print({
          id: require("node:crypto").randomUUID(),
          station,
          kind: station === "bill" ? "BILL" : "TEST",
          tableName: station === "bill" ? "Table 1" : "Printer setup",
          createdAt: new Date().toISOString(),
          actor: "Manager",
          items: [
            {
              qty: 1,
              name:
                station === "bill"
                  ? "Test bill / Тест"
                  : "Test ticket / Тест",
              price: station === "bill" ? 1295 : 0,
              note: "Check width, cutter and Cyrillic characters.",
            },
          ],
        });
      });
      printTimer = setInterval(async () => {
        if (printing) return;
        const job = engine.state.jobs.find((j) => j.status === "queued");
        if (!job) return;
        printing = true;
        engine.updateJob(job.id, {
          status: "printing",
          attempts: job.attempts + 1,
        });
        try {
          await print(job);
          engine.updateJob(job.id, {
            status: "spooled",
            printedAt: new Date().toISOString(),
            error: "",
          });
        } catch (e) {
          engine.updateJob(job.id, { status: "error", error: e.message });
        } finally {
          printing = false;
        }
      }, 1000);
      powerSaveBlocker.start("prevent-app-suspension");
      await win.loadFile(path.join(__dirname, "../dist/index.html"));
    })
    .catch((e) => {
      dialog.showErrorBox(
        "Restaurant POS could not start",
        e.stack || e.message,
      );
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    clearInterval(printTimer);
    stopCloud?.();
    hub?.close();
  });
}
