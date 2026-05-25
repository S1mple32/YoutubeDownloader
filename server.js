const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const { spawn } = require("child_process");

const startedAt = new Date();
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
const appVersion = packageInfo.version || "0.0.0";
const runtimeRoot = process.env.YTMARK1_HOME || __dirname;
const publicDir = path.join(__dirname, "public");
const defaultDownloadsDir = path.join(runtimeRoot, "downloads");
const dataDir = path.join(runtimeRoot, "data");
const statePath = path.join(dataDir, "app-state.json");
const secretsDir = path.join(runtimeRoot, "secrets");
const cookiesPath = path.join(secretsDir, "youtube-cookies.txt");
const downloaderBin = process.env.DOWNLOADER_BIN || "yt-dlp";
const ffmpegBin = process.env.FFMPEG_BIN || null;
const updateOwner = process.env.YTMARK1_UPDATE_OWNER || "S1mple32";
const updateRepo = process.env.YTMARK1_UPDATE_REPO || "YoutubeDownloader";

const jobs = [];
let playlists = [];
let downloadHistory = [];
let settings = {
  downloadsDir: defaultDownloadsDir,
  lastUpdateCheck: null
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

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": `YtMark1/${appVersion}`,
        ...headers
      }
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk.toString(); });

      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Update check failed with HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error("Update server returned invalid JSON"));
        }
      });
    });

    request.on("error", (error) => reject(error));
  });
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
    version: appVersion,
    environment: process.env.NODE_ENV || "development",
    hostname: os.hostname(),
    queuedJobs: jobs.length,
    syncedPlaylists: playlists.length,
    cookiesConfigured: fs.existsSync(cookiesPath),
    downloadsDir: getDownloadsDir(),
    tools: {
      downloaderBin,
      downloaderExists: fs.existsSync(downloaderBin),
      ffmpegBin: ffmpegBin || null,
      ffmpegExists: ffmpegBin ? fs.existsSync(ffmpegBin) : false
    }
  };
}

function parseVersion(value) {
  return String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
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
  const outputName = filenameFromUrl(job.url, "video");
  const targetPath = path.join(job.outputDir || getDownloadsDir(), outputName);

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
  const outputTemplate = path.join(job.outputDir || getDownloadsDir(), `%(title).120s.%(ext)s`);
  const args = [
    "--newline",
    "--no-playlist",
    "--restrict-filenames",
    job.forceDownload ? "--force-overwrites" : "--no-overwrites",
    "--concurrent-fragments",
    "8",
    "--js-runtimes", "node",
    "--remote-components", "ejs:github",
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
    args.push("-f", "bestvideo+bestaudio/b/best");
  } else if (job.quality === "2160p-only") {
    args.push("-f", "bestvideo[height=2160]+bestaudio/b[height=2160]/bestvideo+bestaudio/b/best");
  } else {
    const height = Number.parseInt(job.quality, 10);
    const formatSelector = Number.isFinite(height)
      ? `bestvideo[height<=${height}]+bestaudio/b[height<=${height}]/bestvideo+bestaudio/b/best`
      : "bestvideo+bestaudio/b/best";
    args.push("-f", formatSelector);
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

function updateStatusPayload() {
  const cached = settings.lastUpdateCheck;
  return {
    currentVersion: appVersion,
    repository: `https://github.com/${updateOwner}/${updateRepo}`,
    ...(cached || {
      checkedAt: null,
      latestVersion: null,
      hasUpdate: false,
      releaseUrl: null,
      error: null
    })
  };
}

async function checkForUpdates() {
  const release = await fetchJson(`https://api.github.com/repos/${updateOwner}/${updateRepo}/releases/latest`);
  const latestVersion = String(release.tag_name || release.name || "").replace(/^v/i, "") || appVersion;
  const payload = {
    checkedAt: new Date().toISOString(),
    latestVersion,
    hasUpdate: compareVersions(latestVersion, appVersion) > 0,
    releaseUrl: release.html_url || `https://github.com/${updateOwner}/${updateRepo}/releases`,
    error: null
  };

  settings.lastUpdateCheck = payload;
  saveState();
  return updateStatusPayload();
}

function isActiveJob(job) {
  return job.status === "queued" || job.status === "downloading" || job.status === "merging";
}

function clearQueue() {
  const activeJobs = jobs.filter(isActiveJob);
  const removed = jobs.length - activeJobs.length;
  jobs.length = 0;
  jobs.push(...activeJobs);

  return {
    removed,
    remaining: jobs.length,
    keptActive: activeJobs.length
  };
}

function removeJob(id) {
  const index = jobs.findIndex((j) => j.id === id);
  if (index === -1) return null;
  const job = jobs[index];

  if (job.output) {
    const full = path.isAbsolute(job.output) ? job.output : path.join(runtimeRoot, job.output);
    try { fs.unlinkSync(full); } catch (_) {}
    try { fs.unlinkSync(full + ".part"); } catch (_) {}
    // yt-dlp intermediate fragment files e.g. Title.f137.mp4
    const dir = path.dirname(full);
    const base = path.basename(full, path.extname(full));
    try {
      fs.readdirSync(dir).filter((f) => f.startsWith(base + ".f")).forEach((f) => {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      });
    } catch (_) {}
  }

  jobs.splice(index, 1);
  return job;
}

function purgeAllJobs() {
  const snapshot = [...jobs];
  jobs.length = 0;
  let deleted = 0;
  for (const job of snapshot) {
    if (job.output) {
      const full = path.isAbsolute(job.output) ? job.output : path.join(runtimeRoot, job.output);
      try { fs.unlinkSync(full); deleted++; } catch (_) {}
      try { fs.unlinkSync(full + ".part"); } catch (_) {}
    }
  }
  return { removed: snapshot.length, filesDeleted: deleted };
}

function clearHistory() {
  const removed = downloadHistory.length;
  downloadHistory = [];
  saveState();
  return {
    removed,
    remaining: 0
  };
}

function updateDownloaderProgress(job, line) {
  const cleanLine = line.replace(/\[[0-9;]*m/g, "").trim();
  const percentMatch = cleanLine.match(/\[download\]\s+([0-9.]+)%/);
  const fragmentMatch = cleanLine.match(/\[download\]\s+Got error|^\[download\]\s+fragment/i);
  const destinationMatch = cleanLine.match(/\[download\]\s+Destination:\s+(.+)/);
  const mergerStartMatch = cleanLine.match(/\[(Merger|VideoConvertor|ExtractAudio)\]/);
  const mergedMatch = cleanLine.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/);

  const skippedMatch = cleanLine.match(/has already been downloaded/);
  if (skippedMatch) {
    job.status = "skipped";
    job.progress = 100;
    job.message = "File already exists — skipped. Use ↻ Force to re-download.";
    job.updatedAt = new Date().toISOString();
    return;
  }

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
    cwd: runtimeRoot,
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
    if (job.status === "blocked" || job.status === "skipped") {
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

function createJob({ url, quality, format, permissionConfirmed, outputDir, forceDownload }) {
  const safeUrl = assertWebUrl(url);

  let resolvedOutputDir = null;
  if (outputDir) {
    resolvedOutputDir = normalizeDownloadDir(outputDir);
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
  }

  if (!permissionConfirmed) {
    return {
      id: randomUUID(),
      url: safeUrl,
      source: sourceFromUrl(safeUrl),
      quality,
      format,
      outputDir: resolvedOutputDir,
      forceDownload: Boolean(forceDownload),
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
    outputDir: resolvedOutputDir,
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

// ── Playlist sync (real) ────────────────────────────────────────

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

function fetchPlaylistVideos(url) {
  return new Promise((resolve, reject) => {
    const args = [
      "--flat-playlist",
      "--dump-json",
      "--no-warnings",
      "--yes-playlist"
    ];

    if (fs.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }

    args.push(url);

    const child = spawn(downloaderBin, args, {
      cwd: runtimeRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const videos = [];
    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          const id = entry.id;
          const videoUrl = entry.webpage_url || entry.url || (id ? `https://www.youtube.com/watch?v=${id}` : null);
          if (id && videoUrl) {
            videos.push({ id, url: videoUrl, title: entry.title || id });
          }
        } catch {
          // skip non-JSON lines
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      // flush any remaining stdout
      if (stdout.trim()) {
        try {
          const entry = JSON.parse(stdout.trim());
          const id = entry.id;
          const videoUrl = entry.webpage_url || entry.url || (id ? `https://www.youtube.com/watch?v=${id}` : null);
          if (id && videoUrl) {
            videos.push({ id, url: videoUrl, title: entry.title || id });
          }
        } catch {}
      }

      if (code !== 0 && videos.length === 0) {
        const lastError = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || `yt-dlp exited with code ${code}`;
        reject(new Error(lastError));
      } else {
        resolve(videos);
      }
    });
  });
}

async function performPlaylistSync(playlist, reason = "manual") {
  if (playlist.status === "syncing") return playlist;

  const now = new Date();
  playlist.status = "syncing";
  playlist.lastSyncAt = now.toISOString();
  playlist.lastSyncReason = reason;
  playlist.nextSyncAt = nextSyncDate(playlist.schedule, now)?.toISOString() || null;
  playlist.lastError = null;
  saveState();

  try {
    const videos = await fetchPlaylistVideos(playlist.url);
    const seenIds = new Set(Array.isArray(playlist.seenIds) ? playlist.seenIds : []);
    const isFirstSync = seenIds.size === 0;
    const newVideos = isFirstSync ? [] : videos.filter((v) => !seenIds.has(v.id));

    playlist.itemsFound = videos.length;
    playlist.newItems = newVideos.length;
    // On first sync: record everything as seen so only future additions get queued
    playlist.seenIds = [...new Set([...seenIds, ...videos.map((v) => v.id)])];
    playlist.status = "synced";

    if (isFirstSync) {
      console.log(`[sync] ${playlist.name}: ${videos.length} total — first sync, recording as seen (reason: ${reason})`);
    } else {
      for (const video of newVideos) {
        const job = createJob({
          url: video.url,
          quality: playlist.quality || "1080p",
          format: playlist.format || "mp4",
          permissionConfirmed: true,
          outputDir: playlist.saveDir || null
        });
        jobs.unshift(job);
      }
      console.log(`[sync] ${playlist.name}: ${videos.length} total, ${newVideos.length} new queued (${reason})`);
    }
  } catch (error) {
    playlist.status = "error";
    playlist.lastError = error.message;
    console.error(`[sync] ${playlist.name} failed: ${error.message}`);
  }

  saveState();
  return playlist;
}

function syncPlaylist({ url, name, interval, scheduleType, intervalHours, timeOfDay, quality, format, saveDir, seenIds, toDownload }) {
  const safeUrl = assertWebUrl(url);
  const schedule = normalizeSchedule({ scheduleType, interval, intervalHours, timeOfDay });
  const resolvedSaveDir = saveDir ? normalizeDownloadDir(saveDir) : null;
  if (resolvedSaveDir) fs.mkdirSync(resolvedSaveDir, { recursive: true });

  const hasPreview = Array.isArray(seenIds) && seenIds.length > 0;
  const now = new Date();

  const playlist = {
    id: randomUUID(),
    name: name || `${sourceFromUrl(safeUrl)} playlist`,
    url: safeUrl,
    source: sourceFromUrl(safeUrl),
    interval: schedule.label,
    schedule,
    quality: quality || "1080p",
    format: format || "mp4",
    saveDir: resolvedSaveDir,
    itemsFound: hasPreview ? seenIds.length : 0,
    newItems: hasPreview ? (Array.isArray(toDownload) ? toDownload.length : 0) : 0,
    seenIds: hasPreview ? [...new Set(seenIds)] : [],
    lastSyncAt: hasPreview ? now.toISOString() : null,
    nextSyncAt: hasPreview ? (nextSyncDate(schedule, now)?.toISOString() || null) : null,
    lastSyncReason: hasPreview ? "created" : null,
    lastError: null,
    status: hasPreview ? "synced" : "pending"
  };

  playlists.unshift(playlist);

  if (hasPreview) {
    if (Array.isArray(toDownload)) {
      for (const video of toDownload) {
        const job = createJob({
          url: video.url,
          quality: video.quality || quality || "1080p",
          format: video.format || format || "mp4",
          permissionConfirmed: true,
          outputDir: resolvedSaveDir
        });
        jobs.unshift(job);
      }
    }
    console.log(`[sync] ${playlist.name}: ${seenIds.length} seen, ${toDownload?.length ?? 0} queued from preview`);
    saveState();
  } else {
    performPlaylistSync(playlist, "created");
  }

  return playlist;
}

function runScheduledPlaylistSyncs() {
  const now = new Date();

  playlists.forEach((playlist) => {
    if (playlist.status === "syncing") return;
    if (!playlist.nextSyncAt || new Date(playlist.nextSyncAt) > now) return;
    performPlaylistSync(playlist, "scheduled");
  });
}

setInterval(runScheduledPlaylistSyncs, 60 * 1000);

// ── Static file serving ─────────────────────────────────────────

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

// ── API ─────────────────────────────────────────────────────────

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
        permissionConfirmed: Boolean(body.permissionConfirmed),
        outputDir: body.outputDir || null,
        forceDownload: Boolean(body.forceDownload)
      });

      jobs.unshift(job);
      sendJson(res, job.status === "blocked" ? 422 : 201, { job });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }

    return true;
  }

  if (req.url === "/api/jobs/purge" && req.method === "DELETE") {
    sendJson(res, 200, purgeAllJobs());
    return true;
  }

  const jobRemoveMatch = req.url.match(/^\/api\/jobs\/([^/]+)$/) && req.method === "DELETE";
  if (jobRemoveMatch) {
    const id = req.url.split("/")[3];
    const job = removeJob(id);
    if (!job) { sendJson(res, 404, { error: "Job not found" }); return true; }
    sendJson(res, 200, { removed: 1, id });
    return true;
  }

  if (req.url === "/api/jobs" && req.method === "DELETE") {
    sendJson(res, 200, clearQueue());
    return true;
  }

  if (req.url === "/api/playlists" && req.method === "GET") {
    sendJson(res, 200, { playlists });
    return true;
  }

  if (req.url === "/api/playlists/preview" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const safeUrl = assertWebUrl(body.url);
      const videos = await fetchPlaylistVideos(safeUrl);
      sendJson(res, 200, { videos, count: videos.length });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
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
        timeOfDay: body.timeOfDay,
        quality: body.quality,
        format: body.format,
        saveDir: body.saveDir || null,
        seenIds: Array.isArray(body.seenIds) ? body.seenIds : [],
        toDownload: Array.isArray(body.toDownload) ? body.toDownload : null
      });

      sendJson(res, 201, { playlist });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }

    return true;
  }

  // Delete a playlist: DELETE /api/playlists/:id
  const deleteMatch = req.url.match(/^\/api\/playlists\/([^/]+)$/) && req.method === "DELETE";
  if (deleteMatch) {
    const id = req.url.split("/")[3];
    const index = playlists.findIndex((p) => p.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Playlist not found" });
      return true;
    }
    playlists.splice(index, 1);
    saveState();
    sendJson(res, 200, { removed: 1 });
    return true;
  }

  // Manual re-sync of an existing playlist: POST /api/playlists/:id/sync
  const resyncMatch = req.url.match(/^\/api\/playlists\/([^/]+)\/sync$/) && req.method === "POST";
  if (resyncMatch) {
    const id = req.url.split("/")[3];
    const playlist = playlists.find((p) => p.id === id);

    if (!playlist) {
      sendJson(res, 404, { error: "Playlist not found" });
      return true;
    }

    if (playlist.status === "syncing") {
      sendJson(res, 409, { error: "Sync already in progress" });
      return true;
    }

    performPlaylistSync(playlist, "manual");
    sendJson(res, 202, { playlist });
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

  if (req.url === "/api/history" && req.method === "DELETE") {
    sendJson(res, 200, clearHistory());
    return true;
  }

  // Rename a history entry's output file: PATCH /api/history/:id
  const historyRenameMatch = req.url.match(/^\/api\/history\/([^/]+)$/) && req.method === "PATCH";
  if (historyRenameMatch) {
    const id = req.url.split("/")[3];
    const entry = downloadHistory.find((e) => e.id === id);
    if (!entry) { sendJson(res, 404, { error: "Not found" }); return true; }
    try {
      const body = await readJson(req);
      const rawName = String(body.newName || "").trim();
      if (!rawName) throw new Error("Name cannot be empty");
      const newName = rawName.replace(/[^a-zA-Z0-9 ._-]/g, "_");
      const oldFull = path.isAbsolute(entry.output) ? entry.output : path.join(runtimeRoot, entry.output);
      const dir = path.dirname(oldFull);
      const oldExt = path.extname(oldFull);
      const newExt = path.extname(newName);
      const finalName = newExt ? newName : newName + oldExt;
      const newFull = path.join(dir, finalName);
      if (path.dirname(newFull) !== dir) throw new Error("Cannot rename across directories");
      if (fs.existsSync(oldFull)) {
        fs.renameSync(oldFull, newFull);
      }
      entry.output = outputLabel(newFull);
      saveState();
      sendJson(res, 200, { entry });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return true;
  }

  if (req.url === "/api/settings/updates" && req.method === "GET") {
    sendJson(res, 200, updateStatusPayload());
    return true;
  }

  if (req.url === "/api/settings/updates" && req.method === "POST") {
    try {
      sendJson(res, 200, await checkForUpdates());
    } catch (error) {
      settings.lastUpdateCheck = {
        checkedAt: new Date().toISOString(),
        latestVersion: null,
        hasUpdate: false,
        releaseUrl: `https://github.com/${updateOwner}/${updateRepo}/releases`,
        error: error.message
      };
      saveState();
      sendJson(res, 502, { error: error.message, ...updateStatusPayload() });
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
