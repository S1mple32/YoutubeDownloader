const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");

let appServer;
let mainWindow;

function downloaderToolsExist(root) {
  const toolsDir = path.join(root, "tools");
  const downloader = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const ffmpeg = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return require("fs").existsSync(path.join(toolsDir, downloader)) &&
    require("fs").existsSync(path.join(toolsDir, ffmpeg));
}

async function createMainWindow() {
  const userData = app.getPath("userData");
  const bundledRoot = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
  process.env.YTMARK1_HOME = userData;
  process.env.YTMARK1_RESOURCE_ROOT = downloaderToolsExist(userData) ? userData : bundledRoot;

  if (!downloaderToolsExist(process.env.YTMARK1_RESOURCE_ROOT)) {
    try {
      const { installDependencies } = require("../scripts/install-dependencies");
      await installDependencies({ installRoot: userData, skipIfPresent: true });
      process.env.YTMARK1_RESOURCE_ROOT = userData;
    } catch (error) {
      process.env.YTMARK1_RESOURCE_ROOT = bundledRoot;
      if (!downloaderToolsExist(bundledRoot)) {
        dialog.showMessageBox({
          type: "warning",
          title: "Downloader dependencies were not installed",
          message: "YtMark1 opened, but downloader tools could not be prepared automatically.",
          detail: error.message
        });
      }
    }
  }

  const { startServer } = require("../server");
  const started = await startServer({ port: 0, host: "127.0.0.1" });
  appServer = started.server;

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "YtMark1",
    backgroundColor: "#f4f6f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${started.port}`);
}

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    dialog.showErrorBox("YtMark1 could not start", error.stack || error.message);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (appServer) {
    appServer.close();
  }
});
