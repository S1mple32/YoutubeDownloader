const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");

const startedAt = new Date();
const runtimeRoot = process.env.YTMARK1_HOME || __dirname;
const publicDir = path.join(__dirname, "public");
const defaultDownloadsDir = path.join(runtimeRoot, "downloads");
const dataDir = path.join(runtimeRoot, "data");
const statePath = path.join(dataDir, "app-state.json");
const secretsDir = path.join(runtimeRoot, "secrets");
const cookiesPath = path.join(secretsDir, "youtube-cookies.txt");
const resourceRoot = process.env.YTMARK1_RESOURCE_ROOT || __dirname;
const localDownloaderBin = process.platform === "win32"
  ? path.join(resourceRoot, ".venv", "Scripts", "yt-dlp.exe")
  : path.join(resourceRoot, ".venv", "bin", "yt-dlp");
const localFfmpegDir = path.join(resourceRoot, ".venv");
const localFfmpegBin = findLocalFfmpeg(localFfmpegDir);
const downloaderBin = process.env.DOWNLOADER_BIN || (fs.existsSync(localDownloaderBin) ? localDownloaderBin : "yt-dlp");
const ffmpegBin = process.env.FFMPEG_BIN || (fs.existsSync(localFfmpegBin) ? localFfmpegBin : null);

const jobs = [];
let playlists = [];
let downloadHistory = [];
let settings = {
  downloadsDir: defaultDownloadsDir
};
fs.mkdirSync(defaultDownloadsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(secretsDir, { recursive: true });

function normalizeDownloadDir(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return defaultDownloadsDir;
  }

  const trimmed = value.trim();
  return path.normalize(path.isAbsolute(trimmed) ? trimmed : path.resolve(runtimeRoot, trimmed));
}

function findLocalFfmpeg(searchRoot) {
  if (!fs.existsSync(searchRoot)) {
    return null;
  }

  const stack = [searchRoot];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (/^ffmpeg(?:\.exe)?(?:-.+)?$/i.test(entry.name)) {
        return entryPath;
      }
    }
  }

  return null;
}

function getDownloadsDir() {
  return normalizeDownloadDir(settings.downloadsDir);
}

function outputLabel(filePath) {
  const normalized = path.normalize(filePath);
  return normalized.startsWith(runtimeRoot) ? path.relative(runtimeRoot, normalized) : normalized;
}

function loadState() {
  try {
    if (!fs.existsSync(statePath)) {
      return;
    }

    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    playlists = Array.isArray(state.playlists) ? state.playlists : [];
    downloadHistory = Array.isArray(state.downloadHistory) ? state.downloadHistory : [];
    settings = {
      ...settings,
      ...(state.settings || {}),
      downloadsDir: normalizeDownloadDir(state.settings?.downloadsDir)
    };
    fs.mkdirSync(getDownloadsDir(), { recursive: true });
  } catch (error) {
    console.warn(`Could not load app state: ${error.message}`);
  }
}

function saveState() {
  const state = {
    playlists,
    downloadHistory,
    settings,
    savedAt: new Date().toISOString()
  };

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

loadState();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function send(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function statusPayload() {
  return {
    app: "media-sync-dock",
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: startedAt.toISOString(),
    environment: process.env.NODE_ENV || "development",
    hostname: os.hostname(),
    queuedJobs: jobs.length,
    syncedPlaylists: playlists.length,
    cookiesConfigured: fs.existsSync(cookiesPath),
    downloadsDir: getDownloadsDir()
  };
}

function sourceFromUrl(url) {
  const host = new URL(url).hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) {
    return "YouTube";
  }

  if (host.includes("vimeo")) {
    return "Vimeo";
  }

  return host;
}

function isDirectMediaUrl(url) {
  return /\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg)(\?.*)?$/i.test(url);
}

function filenameFromUrl(url, fallback) {
  const parsed = new URL(url);
  const basename = path.basename(parsed.pathname) || `${fallback}.bin`;
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function assertWebUrl(value) {
  const parsed = new URL(value);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https links are supported");
  }

  return parsed.toString();
}

function runDirectDownload(job) {
  const client = job.url.startsWith("https:") ? https : http;
  const outputName = `${job.id}-${filenameFromUrl(job.url, "video")}`;
  const targetPath = path.join(getDownloadsDir(), outputName);

  job.status = "downloading";
  job.message = "Downloading direct media file";
  job.output = outputLabel(targetPath);
  job.updatedAt = new Date().toISOString();

  const request = client.get(job.url, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      job.url = new URL(response.headers.location, job.url).toString();
      runDirectDownload(job);
      return;
    }

    if (response.statusCode !== 200) {
      job.status = "blocked";
      job.message = `Download failed with HTTP ${response.statusCode}`;
      job.updatedAt = new Date().toISOString();
      return;
    }

    const total = Number(response.headers["content-length"] || 0);
    let downloaded = 0;
    const file = fs.createWriteStream(targetPath);

    response.on("data", (chunk) => {
      downloaded += chunk.length;

      if (total > 0) {
        job.progress = Math.min(99, Math.floor((downloaded / total) * 100));
        job.updatedAt = new Date().toISOString();
      }
    });

    response.pipe(file);

    file.on("finish", () => {
      file.close();
      completeJob(job, job.output);
    });
  });

  request.on("error", (error) => {
    job.status = "blocked";
    job.message = error.message;
    job.updatedAt = new Date().toISOString();
  });
}

function completeJob(job, output) {
  job.status = "complete";
  job.progress = 100;
  job.output = output || job.output;
  job.message = job.output ? `Saved to ${job.output}` : "Download complete";
  job.updatedAt = new Date().toISOString();

  if (!downloadHistory.some((entry) => entry.jobId === job.id)) {
    downloadHistory.unshift({
      id: randomUUID(),
      jobId: job.id,
      source: job.source,
      url: job.url,
      quality: job.quality,
      format: job.format,
      output: job.output || "downloads/",
      completedAt: job.updatedAt
    });
    saveState();
  }
}

function argsForDownloader(job) {
  const outputTemplate = path.join(getDownloadsDir(), `${job.id}-%(title).120s.%(ext)s`);
  const args = [
    "--newline",
    "--no-playlist",
    "--restrict-filenames",
    "--concurrent-fragments",
    "8",
    "--js-runtimes",
    `node:${process.execPath}`,
    "--remote-components",
    "ejs:github",
    "-o",
    outputTemplate
  ];

  if (ffmpegBin) {
    args.push("--ffmpeg-location", ffmpegBin);
  }

  if (fs.existsSync(cookiesPath)) {
    args.push("--cookies", cookiesPath);
  }

  if (job.format === "mp3" || job.quality === "audio") {
    args.push("-x", "--audio-format", "mp3");
  } else if (job.quality === "best") {
    args.push("-f", "bv*+ba/best");
  } else if (job.quality === "2160p-only") {
    args.push("-f", "bv*[height=2160]+ba/b[height=2160]", "-S", "res:2160");
  } else {
    const height = Number.parseInt(job.quality, 10);
    const formatSelector = Number.isFinite(height)
      ? `bv*[height<=${height}]+ba/b[height<=${height}]/bv*+ba/best`
      : "bv*+ba/best";
    args.push("-f", formatSelector, "-S", Number.isFinite(height) ? `res:${height}` : "res");
  }

  if (job.format === "mp4") {
    args.push("--merge-output-format", "mp4");
  } else if (job.format === "webm") {
    args.push("--merge-output-format", "webm");
  }

  args.push(job.url);
  return args;
}

function saveCookies(content) {
  if (typeof content !== "string" || content.trim().length < 20) {
    throw new Error("Choose a valid cookies.txt file first");
  }

  if (!content.includes("youtube.com") && !content.includes(".youtube.com")) {
    throw new Error("This does not look like a YouTube cookies file");
  }

  fs.writeFileSync(cookiesPath, content, { mode: 0o600 });
  return {
    configured: true,
    path: "secrets/youtube-cookies.txt",
    bytes: Buffer.byteLength(content)
  };
}

function saveDownloadSettings(downloadsDirValue) {
  const nextDir = normalizeDownloadDir(downloadsDirValue);
  fs.mkdirSync(nextDir, { recursive: true });

  try {
    fs.accessSync(nextDir, fs.constants.W_OK);
  } catch (error) {
    throw new Error("Download folder is not writable by this app");
  }

  settings.downloadsDir = nextDir;
  saveState();

  return {
    downloadsDir: getDownloadsDir()
  };
}

function updateDownloaderProgress(job, line) {
  const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const percentMatch = cleanLine.match(/\[download\]\s+([0-9.]+)%/);
  const fragmentMatch = cleanLine.match(/\[download\]\s+Got error|^\[download\]\s+fragment/i);
  const destinationMatch = cleanLine.match(/\[download\]\s+Destination:\s+(.+)/);
  const mergerStartMatch = cleanLine.match(/\[(Merger|VideoConvertor|ExtractAudio)\]/);
  const mergedMatch = cleanLine.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/);

  if (percentMatch) {
    job.progress = Math.min(99, Math.floor(Number(percentMatch[1])));
    job.status = "downloading";
    job.message = cleanLine.replace(/^\[download\]\s*/, "") || "Downloading with yt-dlp";
  } else if (fragmentMatch) {
    job.status = "downloading";
    job.message = cleanLine;
  } else if (mergerStartMatch) {
    job.status = "merging";
    job.progress = Math.max(job.progress, 99);
    job.message = "Merging video and audio with ffmpeg";
  }

  if (destinationMatch || mergedMatch) {
    const filePath = destinationMatch?.[1] || mergedMatch?.[1];
    job.output = outputLabel(filePath);
  }

  job.updatedAt = new Date().toISOString();
}

function runDownloader(job) {
  job.status = "downloading";
  job.message = "Starting yt-dlp";
  job.updatedAt = new Date().toISOString();

  const child = spawn(downloaderBin, argsForDownloader(job), {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let errorLog = "";

  child.stdout.on("data", (chunk) => {
    chunk.toString().split(/\r?\n/).forEach((line) => {
      if (line.trim()) {
        updateDownloaderProgress(job, line);
      }
    });
  });

  child.stderr.on("data", (chunk) => {
    errorLog += chunk.toString();
    job.message = errorLog.trim().split(/\r?\n/).slice(-1)[0] || "Downloader is working";
    job.updatedAt = new Date().toISOString();
  });

  child.on("error", (error) => {
    job.status = "blocked";
    job.progress = 0;
    job.message = error.code === "ENOENT"
      ? "yt-dlp is not installed. Run with Docker or install yt-dlp locally."
      : error.message;
    job.updatedAt = new Date().toISOString();
  });

  child.on("close", (code) => {
    if (job.status === "blocked") {
      return;
    }

    if (code === 0) {
      completeJob(job);
    } else {
      job.status = "blocked";
      job.message = errorLog.trim().split(/\r?\n/).slice(-1)[0] || `yt-dlp exited with code ${code}`;
      job.updatedAt = new Date().toISOString();
    }
  });
}

function tickJob(job) {
  if (job.status === "complete" || job.status === "blocked") {
    return;
  }

  job.progress = Math.min(100, job.progress + 8 + Math.floor(Math.random() * 12));
  job.status = job.progress >= 100 ? "complete" : "downloading";
  job.updatedAt = new Date().toISOString();

  if (job.status !== "complete") {
    setTimeout(() => tickJob(job), 900);
  }
}

function createJob({ url, quality, format, permissionConfirmed }) {
  const safeUrl = assertWebUrl(url);

  if (!permissionConfirmed) {
    return {
      id: randomUUID(),
      url: safeUrl,
      source: sourceFromUrl(safeUrl),
      quality,
      format,
      status: "blocked",
      progress: 0,
      message: "Confirm you have rights or permission to download this media.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const job = {
    id: randomUUID(),
    url: safeUrl,
    source: sourceFromUrl(safeUrl),
    quality,
    format,
    status: "queued",
    progress: 0,
    message: "Queued for download",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isDirectMediaUrl(safeUrl)) {
    setTimeout(() => runDirectDownload(job), 250);
  } else if (job.source === "YouTube") {
    setTimeout(() => runDownloader(job), 250);
  } else {
    setTimeout(() => tickJob(job), 500);
  }

  return job;
}

function normalizeSchedule({ scheduleType, interval, intervalHours, timeOfDay }) {
  const type = scheduleType || interval || "manual";

  if (type === "manual") {
    return { type: "manual", label: "Manual", intervalHours: null, timeOfDay: null };
  }

  if (type === "daily-time") {
    if (!/^\d{2}:\d{2}$/.test(timeOfDay || "")) {
      throw new Error("Choose a valid sync time");
    }

    return { type, label: `Daily at ${timeOfDay}`, intervalHours: null, timeOfDay };
  }

  const hours = type === "custom-interval"
    ? Number(intervalHours)
    : Number.parseInt(type, 10);

  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    throw new Error("Interval must be between 1 and 168 hours");
  }

  return {
    type: "interval",
    label: `Every ${hours} hour${hours === 1 ? "" : "s"}`,
    intervalHours: hours,
    timeOfDay: null
  };
}

function nextSyncDate(schedule, from = new Date()) {
  if (schedule.type === "manual") {
    return null;
  }

  if (schedule.type === "daily-time") {
    const [hours, minutes] = schedule.timeOfDay.split(":").map(Number);
    const next = new Date(from);
    next.setHours(hours, minutes, 0, 0);

    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  return new Date(from.getTime() + schedule.intervalHours * 60 * 60 * 1000);
}

function performPlaylistSync(playlist, reason = "manual") {
  const now = new Date();
  const previousCount = playlist.itemsFound || 0;
  const discovered = Math.floor(Math.random() * 4);

  playlist.itemsFound = Math.max(previousCount, previousCount + discovered);
  playlist.newItems = discovered;
  playlist.lastSyncAt = now.toISOString();
  playlist.nextSyncAt = nextSyncDate(playlist.schedule, now)?.toISOString() || null;
  playlist.lastSyncReason = reason;
  playlist.status = "synced";
  saveState();
  return playlist;
}

function syncPlaylist({ url, name, interval, scheduleType, intervalHours, timeOfDay }) {
  const safeUrl = assertWebUrl(url);
  const schedule = normalizeSchedule({ scheduleType, interval, intervalHours, timeOfDay });
  const playlist = {
    id: randomUUID(),
    name: name || `${sourceFromUrl(safeUrl)} playlist`,
    url: safeUrl,
    source: sourceFromUrl(safeUrl),
    interval: schedule.label,
    schedule,
    itemsFound: 8 + Math.floor(Math.random() * 36),
    newItems: 0,
    lastSyncAt: null,
    nextSyncAt: null,
    lastSyncReason: null,
    status: "pending"
  };

  playlists.unshift(playlist);
  performPlaylistSync(playlist, "created");
  return playlist;
}

function runScheduledPlaylistSyncs() {
  const now = new Date();

  playlists.forEach((playlist) => {
    if (!playlist.nextSyncAt || new Date(playlist.nextSyncAt) > now) {
      return;
    }

    performPlaylistSync(playlist, "scheduled");
  });
}

setInterval(runScheduledPlaylistSyncs, 30 * 1000);

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, mimeTypes[path.extname(filePath)] || "application/octet-stream");
  });
}

async function handleApi(req, res) {
  if (req.url === "/api/status" && req.method === "GET") {
    sendJson(res, 200, statusPayload());
    return true;
  }

  if (req.url === "/api/jobs" && req.method === "GET") {
    sendJson(res, 200, { jobs });
    return true;
  }

  if (req.url === "/api/history" && req.method === "GET") {
    sendJson(res, 200, { history: downloadHistory });
    return true;
  }

  if (req.url === "/api/jobs" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const job = createJob({
        url: body.url,
        quality: body.quality || "1080p",
        format: body.format || "mp4",
        permissionConfirmed: Boolean(body.permissionConfirmed)
      });

      jobs.unshift(job);
      sendJson(res, job.status === "blocked" ? 422 : 201, { job });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }

    return true;
  }

  if (req.url === "/api/playlists" && req.method === "GET") {
    sendJson(res, 200, { playlists });
    return true;
  }

  if (req.url === "/api/playlists/sync" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const playlist = syncPlaylist({
        url: body.url,
        name: body.name,
        interval: body.interval,
        scheduleType: body.scheduleType,
        intervalHours: body.intervalHours,
        timeOfDay: body.timeOfDay
      });

      sendJson(res, 201, { playlist });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }

    return true;
  }

  if (req.url === "/api/settings/cookies" && req.method === "GET") {
    sendJson(res, 200, {
      configured: fs.existsSync(cookiesPath),
      path: fs.existsSync(cookiesPath) ? "secrets/youtube-cookies.txt" : null
    });
    return true;
  }

  if (req.url === "/api/settings/cookies" && req.method === "POST") {
    try {
      const body = await readJson(req);
      sendJson(res, 201, saveCookies(body.content));
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }

    return true;
  }

  if (req.url === "/api/settings/downloads" && req.method === "GET") {
    sendJson(res, 200, {
      downloadsDir: getDownloadsDir(),
      defaultDownloadsDir
    });
    return true;
  }

  if (req.url === "/api/settings/downloads" && req.method === "POST") {
    try {
      const body = await readJson(req);
      sendJson(res, 200, saveDownloadSettings(body.downloadsDir));
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }

    return true;
  }

  return false;
}

function createAppServer() {
  return http.createServer(async (req, res) => {
    if (req.url === "/health") {
      send(res, 200, "ok");
      return;
    }

    if (req.url.startsWith("/api/")) {
      const handled = await handleApi(req, res);

      if (!handled) {
        sendJson(res, 404, { error: "Not found" });
      }

      return;
    }

    serveStatic(req, res);
  });
}

function startServer({ port = process.env.PORT || 3000, host = "0.0.0.0" } = {}) {
  const server = createAppServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      console.log(`Media Sync Dock listening on port ${actualPort}`);
      resolve({ server, port: actualPort });
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createAppServer,
  startServer
};
