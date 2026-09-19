function parseUpdateFeed(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") {
    if (raw.provider === "github" && raw.owner && raw.repo)
      return {
        provider: "github",
        owner: String(raw.owner).trim(),
        repo: String(raw.repo).trim(),
      };
    return parseUpdateFeed(raw.url);
  }
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const github = value.match(/^github:([^/]+)\/([^/]+)$/i);
  if (github)
    return { provider: "github", owner: github[1], repo: github[2] };
  if (!/^https?:\/\//i.test(value)) return null;
  return { provider: "generic", url: value.replace(/\/+$/, "") + "/" };
}

function createUpdater({ app, getFeed, onChange = () => {} }) {
  const status = {
    state: app.isPackaged ? "idle" : "dev",
    version: app.getVersion(),
    nextVersion: "",
    percent: 0,
    error: "",
  };
  const emit = () => onChange({ ...status });
  let autoUpdater;
  const applyFeed = () => {
    const feed = getFeed();
    if (!feed) {
      status.state = "unconfigured";
      status.error = "";
      emit();
      return null;
    }
    autoUpdater.setFeedURL(feed);
    return feed;
  };
  const check = async () => {
    if (!app.isPackaged)
      throw Error("Updates are checked in the installed Windows app");
    if (!applyFeed())
      throw Error("Set an update address in Settings");
    return autoUpdater.checkForUpdates();
  };
  const install = () => {
    if (status.state !== "ready")
      throw Error("No update is ready to install");
    autoUpdater.quitAndInstall(false, true);
  };
  if (app.isPackaged) {
    ({ autoUpdater } = require("electron-updater"));
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.on("checking-for-update", () => {
      status.state = "checking";
      status.error = "";
      emit();
    });
    autoUpdater.on("update-available", (info) => {
      status.state = "available";
      status.nextVersion = info.version;
      status.error = "";
      emit();
    });
    autoUpdater.on("update-not-available", () => {
      status.state = "current";
      status.nextVersion = "";
      status.percent = 0;
      status.error = "";
      emit();
    });
    autoUpdater.on("download-progress", (progress) => {
      status.state = "downloading";
      status.percent = Math.round(progress.percent || 0);
      emit();
    });
    autoUpdater.on("update-downloaded", (info) => {
      status.state = "ready";
      status.nextVersion = info.version;
      status.percent = 100;
      status.error = "";
      emit();
    });
    autoUpdater.on("error", (error) => {
      status.state = "error";
      status.error = error?.message || "Update failed";
      emit();
    });
    setTimeout(() => check().catch(() => {}), 12000);
    setInterval(() => check().catch(() => {}), 4 * 60 * 60 * 1000);
  }
  return {
    status: () => ({ ...status }),
    check,
    install,
  };
}

module.exports = { parseUpdateFeed, createUpdater };
