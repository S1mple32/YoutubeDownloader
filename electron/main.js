const { app, BrowserWindow, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");

let appServer;
let mainWindow;

function toolNames() {
  return {
    downloader: process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
    ffmpeg: process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  };
}

function findToolsInDir(toolsDir) {
  const names = toolNames();
  const downloader = path.join(toolsDir, names.downloader);
  const ffmpeg = path.join(toolsDir, names.ffmpeg);

  if (fs.existsSync(downloader) && fs.existsSync(ffmpeg)) {
    return { root: path.dirname(toolsDir), downloader, ffmpeg };
  }

  return null;
}

function findDownloaderTools(roots) {
  for (const root of roots.filter(Boolean)) {
    const found = findToolsInDir(path.join(root, "tools")) ||
      findToolsInDir(path.join(root, "resources", "tools"));

    if (found) {
      return found;
    }
  }

  return null;
}

function setDownloaderEnvironment(found) {
  if (!found) {
    return;
  }

  process.env.YTMARK1_RESOURCE_ROOT = found.root;
  process.env.DOWNLOADER_BIN = found.downloader;
  process.env.FFMPEG_BIN = found.ffmpeg;
}

function downloaderToolsExist(root) {
  const downloader = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const ffmpeg = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const toolsDir = path.join(root, "tools");
  return fs.existsSync(path.join(toolsDir, downloader)) &&
    fs.existsSync(path.join(toolsDir, ffmpeg));
}

async function createMainWindow() {
  const userData = app.getPath("userData");
  const bundledRoot = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
  const appDir = path.dirname(process.execPath);
  const toolRoots = [
    userData,
    bundledRoot,
    path.join(bundledRoot, "app.asar.unpacked"),
    appDir,
    path.join(appDir, "resources"),
    path.resolve(__dirname, "..")
  ];
  process.env.YTMARK1_HOME = userData;
  process.env.YTMARK1_RESOURCE_ROOT = bundledRoot;
  setDownloaderEnvironment(findDownloaderTools(toolRoots));

  if (!process.env.DOWNLOADER_BIN || !process.env.FFMPEG_BIN) {
    try {
      const { installDependencies } = require("../scripts/install-dependencies");
      await installDependencies({ installRoot: userData, skipIfPresent: true });
      setDownloaderEnvironment(findDownloaderTools(toolRoots));
    } catch (error) {
      setDownloaderEnvironment(findDownloaderTools(toolRoots));
      if (!process.env.DOWNLOADER_BIN || !process.env.FFMPEG_BIN) {
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
