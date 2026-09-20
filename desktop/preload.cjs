const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "posDesktop",
  Object.freeze({
    state: () => ipcRenderer.invoke("pos:state"),
    command: (c) => ipcRenderer.invoke("pos:command", c),
    info: () => ipcRenderer.invoke("pos:info"),
    printers: () => ipcRenderer.invoke("pos:printers"),
    savePrinters: (p) => ipcRenderer.invoke("pos:save-printers", p),
    pair: (p) => ipcRenderer.invoke("pos:pair", p),
    revoke: (id) => ipcRenderer.invoke("pos:revoke", id),
    backup: () => ipcRenderer.invoke("pos:backup"),
    testPrint: (station) => ipcRenderer.invoke("pos:test-print", station),
    saveUpdateUrl: (url) => ipcRenderer.invoke("pos:save-update-url", url),
    checkUpdate: () => ipcRenderer.invoke("pos:check-update"),
    installUpdate: () => ipcRenderer.invoke("pos:install-update"),
    quitApp: (pin) => ipcRenderer.invoke("pos:quit-app", pin),
  }),
);
