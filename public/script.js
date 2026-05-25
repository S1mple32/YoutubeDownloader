const downloadForm = document.querySelector("#download-form");
const playlistForm = document.querySelector("#playlist-form");
const jobList = document.querySelector("#job-list");
const playlistList = document.querySelector("#playlist-list");
const historyList = document.querySelector("#history-list");
const jobsEmpty = document.querySelector("#jobs-empty");
const playlistsEmpty = document.querySelector("#playlists-empty");
const historyEmpty = document.querySelector("#history-empty");
const queueCount = document.querySelector("#queue-count");
const playlistCount = document.querySelector("#playlist-count");
const historyCount = document.querySelector("#history-count");
const queueMessage = document.querySelector("#queue-message");
const historyMessage = document.querySelector("#history-message");
const downloadMessage = document.querySelector("#download-message");
const playlistMessage = document.querySelector("#playlist-message");
const serverState = document.querySelector("#server-state");
const settingsButton = document.querySelector("#settings-button");
const settingsModal = document.querySelector("#settings-modal");
const cookiesForm = document.querySelector("#cookies-form");
const cookiesFile = document.querySelector("#cookies-file");
const cookiesFileName = document.querySelector("#cookies-file-name");
const cookiesMessage = document.querySelector("#cookies-message");
const cookiesStatus = document.querySelector("#cookies-status");
const cookiesDot = document.querySelector("#cookies-dot");
const downloadsForm = document.querySelector("#downloads-form");
const downloadsDir = document.querySelector("#downloads-dir");
const downloadsMessage = document.querySelector("#downloads-message");
const downloadsStatus = document.querySelector("#downloads-status");
const clearQueueButton = document.querySelector("#clear-queue-button");
const clearHistoryButton = document.querySelector("#clear-history-button");
const checkUpdatesButton = document.querySelector("#check-updates-button");
const updateCurrentVersion = document.querySelector("#update-current-version");
const updateLatestVersion = document.querySelector("#update-latest-version");
const updateStatusMessage = document.querySelector("#update-status-message");
const updateDot = document.querySelector("#update-dot");
const updateReleaseLink = document.querySelector("#update-release-link");
const updatesMessage = document.querySelector("#updates-message");
const syncInterval = document.querySelector("#sync-interval");
const scheduleExtra = document.querySelector("#schedule-extra");
const customIntervalField = document.querySelector("#custom-interval-field");
const dailyTimeField = document.querySelector("#daily-time-field");
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");
const previewModal = document.querySelector("#preview-modal");
const previewScrim = document.querySelector("#preview-scrim");
const previewClose = document.querySelector("#preview-close");
const previewSubtitle = document.querySelector("#preview-subtitle");
const previewList = document.querySelector("#preview-list");
const previewSelectedCount = document.querySelector("#preview-selected-count");
const previewSelectAll = document.querySelector("#preview-select-all");
const previewDeselectAll = document.querySelector("#preview-deselect-all");
const previewCancel = document.querySelector("#preview-cancel");
const previewConfirm = document.querySelector("#preview-confirm");

let previewVideos = [];
let pendingPlaylistConfig = null;

/* ── Theme ───────────────────────────────────────────────────── */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☀" : "☾";
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  applyTheme(next);
});

initTheme();

/* ── Settings tabs ───────────────────────────────────────────── */

document.querySelectorAll(".sd-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    document.querySelectorAll(".sd-tab").forEach((t) => {
      t.classList.toggle("sd-tab--active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    document.querySelectorAll(".sd-pane").forEach((pane) => {
      pane.hidden = pane.id !== `tab-${target}`;
    });
  });
});

/* ── Cookies file label ──────────────────────────────────────── */

cookiesFile.addEventListener("change", () => {
  const file = cookiesFile.files[0];
  cookiesFileName.textContent = file ? file.name : "Choose cookies.txt";
});

/* ── Helpers ─────────────────────────────────────────────────── */

function setDot(el, state) {
  el.className = `sd-status-dot${state ? ` sd-status-dot--${state}` : ""}`;
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function request(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.job?.message || "Request failed");
  return data;
}

/* ── Settings open / close ───────────────────────────────────── */

function openSettings() {
  settingsModal.hidden = false;
  loadCookieStatus();
  loadDownloadSettings();
  loadUpdateStatus();
}

function closeSettings() {
  settingsModal.hidden = true;
}

settingsButton.addEventListener("click", openSettings);
document.querySelectorAll("[data-close-settings]").forEach((el) => {
  el.addEventListener("click", closeSettings);
});

/* ── Preview modal ───────────────────────────────────────────── */

function qualityOptions(selected) {
  return [
    ["best", "Best available"], ["2160p", "4K / 2160p"],
    ["1080p", "1080p"], ["720p", "720p"], ["audio", "Audio only"]
  ].map(([v, l]) => `<option value="${v}"${v === selected ? " selected" : ""}>${l}</option>`).join("");
}

function formatOptions(selected) {
  return [
    ["native", "Fast native"], ["mp4", "MP4"], ["webm", "WebM"], ["mp3", "MP3"]
  ].map(([v, l]) => `<option value="${v}"${v === selected ? " selected" : ""}>${l}</option>`).join("");
}

function updatePreviewCount() {
  const total = previewList.querySelectorAll(".preview-item__check").length;
  const checked = previewList.querySelectorAll(".preview-item__check:checked").length;
  previewSelectedCount.textContent = `${checked} of ${total} selected for download`;
}

function openPreviewModal(videos) {
  previewVideos = videos;
  previewSubtitle.textContent = `${videos.length} video${videos.length === 1 ? "" : "s"} found`;
  previewModal.hidden = false;

  const dq = pendingPlaylistConfig?.quality || "1080p";
  const df = pendingPlaylistConfig?.format || "native";

  previewList.innerHTML = "";
  const frag = document.createDocumentFragment();
  videos.forEach((video, idx) => {
    const item = document.createElement("label");
    item.className = "preview-item";
    item.innerHTML = `
      <input type="checkbox" class="preview-item__check" checked data-idx="${idx}">
      <div class="preview-item__info">
        <span class="preview-item__title">${escapeHtml(video.title || video.id)}</span>
        <span class="preview-item__url">${escapeHtml(video.url)}</span>
      </div>
      <div class="preview-item__config">
        <select class="preview-item__quality">${qualityOptions(dq)}</select>
        <select class="preview-item__format">${formatOptions(df)}</select>
      </div>`;
    item.querySelector(".preview-item__config").addEventListener("click", (e) => e.stopPropagation());
    frag.appendChild(item);
  });
  previewList.appendChild(frag);
  updatePreviewCount();
  previewList.querySelectorAll(".preview-item__check").forEach((cb) => {
    cb.addEventListener("change", updatePreviewCount);
  });
}

function closePreviewModal() {
  previewModal.hidden = true;
  previewVideos = [];
  pendingPlaylistConfig = null;
}

previewClose.addEventListener("click", closePreviewModal);
previewCancel.addEventListener("click", closePreviewModal);
previewScrim.addEventListener("click", closePreviewModal);

previewSelectAll.addEventListener("click", () => {
  previewList.querySelectorAll(".preview-item__check").forEach((cb) => { cb.checked = true; });
  updatePreviewCount();
});
previewDeselectAll.addEventListener("click", () => {
  previewList.querySelectorAll(".preview-item__check").forEach((cb) => { cb.checked = false; });
  updatePreviewCount();
});

previewConfirm.addEventListener("click", async () => {
  if (!pendingPlaylistConfig) return;
  const items = previewList.querySelectorAll(".preview-item");
  const allIds = [];
  const toDownload = [];
  items.forEach((item, idx) => {
    const video = previewVideos[idx];
    if (!video) return;
    const checked = item.querySelector(".preview-item__check").checked;
    const quality = item.querySelector(".preview-item__quality").value;
    const format = item.querySelector(".preview-item__format").value;
    allIds.push(video.id);
    if (checked) toDownload.push({ url: video.url, quality, format });
  });
  previewConfirm.disabled = true;
  previewConfirm.textContent = "Adding…";
  try {
    await request("/api/playlists/sync", {
      method: "POST",
      body: JSON.stringify({ ...pendingPlaylistConfig, seenIds: allIds, toDownload })
    });
    closePreviewModal();
    playlistForm.reset();
    updateScheduleControls();
    playlistMessage.textContent = `Playlist added. ${toDownload.length} download${toDownload.length === 1 ? "" : "s"} queued.`;
    await refresh();
  } catch (error) {
    playlistMessage.textContent = error.message;
  } finally {
    previewConfirm.disabled = false;
    previewConfirm.textContent = "Add playlist";
  }
});

/* ── Render helpers ──────────────────────────────────────────── */

function renderJobs(jobs) {
  queueCount.textContent = `${jobs.length} queued`;
  jobsEmpty.hidden = jobs.length > 0;
  jobList.innerHTML = jobs.map((job) => {
    const progress = Math.max(0, Math.min(100, job.progress));
    return `
      <article class="job">
        <div class="job__top">
          <div>
            <strong>${escapeHtml(job.source)}</strong>
            <p>${escapeHtml(job.url)}</p>
          </div>
          <span class="badge badge--${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
        </div>
        <div class="progress" aria-label="Download progress">
          <span style="width: ${progress}%"></span>
        </div>
        <div class="job__meta">
          <span>${escapeHtml(job.quality)} / ${escapeHtml(job.format)}</span>
          <span>${progress}%</span>
        </div>
        <p class="job__message">${escapeHtml(job.message)}</p>
      </article>`;
  }).join("");
}

function renderPlaylists(playlists) {
  playlistCount.textContent = `${playlists.length} synced`;
  playlistsEmpty.hidden = playlists.length > 0;
  playlistList.innerHTML = playlists.map((playlist) => {
    const statusClass = playlist.status === "synced" ? "badge--complete"
      : playlist.status === "syncing" ? "badge--merging"
      : playlist.status === "error" ? "badge--blocked"
      : "";
    const isSyncing = playlist.status === "syncing";
    return `
    <article class="playlist">
      <div class="playlist__header">
        <div>
          <strong>${escapeHtml(playlist.name)}</strong>
          <p>${escapeHtml(playlist.source)} · ${escapeHtml(playlist.url)}</p>
        </div>
        <div class="playlist__actions">
          <span class="badge ${statusClass}">${escapeHtml(playlist.status)}</span>
          <button class="button button--ghost button--compact" data-resync="${escapeHtml(playlist.id)}" ${isSyncing ? "disabled" : ""}>
            ${isSyncing ? "Syncing…" : "↻ Sync"}
          </button>
          <button class="button button--ghost button--compact button--danger" data-delete-playlist="${escapeHtml(playlist.id)}" title="Remove playlist">
            ✕
          </button>
        </div>
      </div>
      ${playlist.lastError ? `<p class="playlist__error">${escapeHtml(playlist.lastError)}</p>` : ""}
      <dl>
        <div><dt>Items</dt><dd>${playlist.itemsFound}</dd></div>
        <div><dt>New</dt><dd>${playlist.newItems}</dd></div>
        <div><dt>Quality</dt><dd>${escapeHtml(playlist.quality || "1080p")}</dd></div>
        <div><dt>Last sync</dt><dd>${formatDate(playlist.lastSyncAt)}</dd></div>
        <div><dt>Next sync</dt><dd>${formatDate(playlist.nextSyncAt)}</dd></div>
        <div><dt>Schedule</dt><dd>${escapeHtml(playlist.interval)}</dd></div>
        ${playlist.saveDir ? `<div><dt>Save to</dt><dd style="overflow-wrap:anywhere;font-size:0.78rem">${escapeHtml(playlist.saveDir)}</dd></div>` : ""}
      </dl>
    </article>`;
  }).join("");

  // wire up re-sync buttons
  document.querySelectorAll("[data-resync]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.resync;
      btn.disabled = true;
      btn.textContent = "Syncing…";
      try {
        await request(`/api/playlists/${id}/sync`, { method: "POST" });
        await refresh();
      } catch (error) {
        btn.disabled = false;
        btn.textContent = "↻ Sync";
      }
    });
  });

  // wire up delete buttons
  document.querySelectorAll("[data-delete-playlist]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deletePlaylist;
      btn.disabled = true;
      try {
        await request(`/api/playlists/${id}`, { method: "DELETE" });
        await refresh();
      } catch (error) {
        btn.disabled = false;
      }
    });
  });
}

function renderHistory(history) {
  historyCount.textContent = `${history.length} saved`;
  historyEmpty.hidden = history.length > 0;
  historyList.innerHTML = history.map((entry) => `
    <article class="history-item" data-history-id="${escapeHtml(entry.id)}">
      <div class="history-item__main">
        <strong>${escapeHtml(entry.source)} · ${escapeHtml(entry.quality)} / ${escapeHtml(entry.format)}</strong>
        <div class="history-item__path">
          <p class="history-item__output">${escapeHtml(entry.output)}</p>
          <button class="button button--ghost button--compact history-item__rename" data-rename="${escapeHtml(entry.id)}" title="Rename file">✎</button>
        </div>
      </div>
      <div>
        <span>${formatDate(entry.completedAt)}</span>
        <p>${escapeHtml(entry.url)}</p>
      </div>
    </article>`).join("");

  document.querySelectorAll("[data-rename]").forEach((btn) => {
    btn.addEventListener("click", () => startRename(btn));
  });
}

function startRename(btn) {
  const id = btn.dataset.rename;
  const article = btn.closest("[data-history-id]");
  const outputEl = article.querySelector(".history-item__output");
  const currentPath = outputEl.textContent;
  const currentName = currentPath.split("/").pop();
  const pathContainer = btn.parentElement;

  pathContainer.innerHTML = `
    <input class="sd-input history-rename-input" value="${escapeHtml(currentName)}" style="flex:1;min-width:0" />
    <button class="sd-btn sd-btn--primary history-rename-save">Save</button>
    <button class="sd-btn history-rename-cancel">✕</button>
  `;

  const input = pathContainer.querySelector(".history-rename-input");
  input.focus();
  input.select();

  pathContainer.querySelector(".history-rename-cancel").addEventListener("click", () => refresh());
  pathContainer.querySelector(".history-rename-save").addEventListener("click", () => doRename(id, input.value, pathContainer));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doRename(id, input.value, pathContainer);
    if (e.key === "Escape") refresh();
  });
}

async function doRename(id, newName, container) {
  const saveBtn = container.querySelector(".history-rename-save");
  if (saveBtn) saveBtn.disabled = true;
  try {
    await request(`/api/history/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ newName })
    });
    await refresh();
  } catch (error) {
    const errEl = document.createElement("p");
    errEl.style.cssText = "margin:4px 0 0;font-size:0.78rem;color:var(--danger);font-weight:700";
    errEl.textContent = error.message;
    container.after(errEl);
    if (saveBtn) saveBtn.disabled = false;
  }
}

/* ── Refresh ─────────────────────────────────────────────────── */

async function refresh() {
  try {
    const [statusData, jobData, playlistData, historyData] = await Promise.all([
      request("/api/status"),
      request("/api/jobs"),
      request("/api/playlists"),
      request("/api/history")
    ]);

    serverState.textContent = statusData.status === "ok" ? "Online" : "Needs attention";
    if (cookiesStatus) {
      const hasCookies = statusData.cookiesConfigured;
      cookiesStatus.textContent = hasCookies ? "Cookies uploaded" : "No cookies uploaded";
      setDot(cookiesDot, hasCookies ? "ok" : "warn");
    }
    downloadsStatus.textContent = statusData.downloadsDir || "Not set";
    updateCurrentVersion.textContent = statusData.version || "Unknown";
    renderJobs(jobData.jobs);
    renderPlaylists(playlistData.playlists);
    renderHistory(historyData.history);
  } catch {
    serverState.textContent = "Offline";
  }
}

/* ── Update status ───────────────────────────────────────────── */

function renderUpdateStatus(data) {
  updateCurrentVersion.textContent = data.currentVersion || "Unknown";
  updateLatestVersion.textContent = data.latestVersion || "—";
  updateReleaseLink.href = data.releaseUrl || "https://github.com/S1mple32/YoutubeDownloader/releases";

  if (data.error) {
    updateStatusMessage.textContent = data.error;
    setDot(updateDot, "error");
    return;
  }
  if (!data.checkedAt) {
    updateStatusMessage.textContent = "Not checked yet";
    setDot(updateDot, "");
    return;
  }
  if (data.hasUpdate) {
    updateStatusMessage.textContent = `Update available: ${data.latestVersion}`;
    setDot(updateDot, "warn");
    return;
  }
  updateStatusMessage.textContent = `Up to date · ${formatDate(data.checkedAt)}`;
  setDot(updateDot, "ok");
}

/* ── Settings loaders ────────────────────────────────────────── */

async function loadCookieStatus() {
  try {
    const data = await request("/api/settings/cookies");
    const ok = data.configured;
    cookiesStatus.textContent = ok ? `Uploaded · ${data.path}` : "No cookies uploaded";
    setDot(cookiesDot, ok ? "ok" : "warn");
  } catch {
    cookiesStatus.textContent = "Could not check cookies";
    setDot(cookiesDot, "error");
  }
}

async function loadDownloadSettings() {
  try {
    const data = await request("/api/settings/downloads");
    downloadsDir.value = data.downloadsDir;
    downloadsStatus.textContent = data.downloadsDir;
  } catch {
    downloadsStatus.textContent = "Could not check folder";
  }
}

async function loadUpdateStatus() {
  try {
    const data = await request("/api/settings/updates");
    renderUpdateStatus(data);
  } catch {
    updateStatusMessage.textContent = "Could not check update status";
    setDot(updateDot, "error");
  }
}

/* ── Form handlers ───────────────────────────────────────────── */

downloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  downloadMessage.textContent = "Adding download...";
  try {
    const outputDirValue = document.querySelector("#output-dir").value.trim();
    const data = await request("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        url: document.querySelector("#video-url").value,
        quality: document.querySelector("#quality").value,
        format: document.querySelector("#format").value,
        permissionConfirmed: document.querySelector("#permission-confirmed").checked,
        outputDir: outputDirValue || null
      })
    });
    downloadForm.reset();
    downloadMessage.textContent = data.job.status === "blocked" ? data.job.message : "Download queued.";
    await refresh();
  } catch (error) {
    downloadMessage.textContent = error.message;
  }
});

cookiesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = cookiesFile.files[0];
  if (!file) {
    cookiesMessage.textContent = "Choose a cookies.txt file first.";
    return;
  }
  cookiesMessage.textContent = "Uploading…";
  try {
    const content = await file.text();
    const data = await request("/api/settings/cookies", {
      method: "POST",
      body: JSON.stringify({ content })
    });
    cookiesMessage.textContent = `Uploaded ${data.bytes} bytes.`;
    cookiesStatus.textContent = `Uploaded · ${data.path}`;
    setDot(cookiesDot, "ok");
    cookiesForm.reset();
    cookiesFileName.textContent = "Choose cookies.txt";
  } catch (error) {
    cookiesMessage.textContent = error.message;
  }
});

downloadsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  downloadsMessage.textContent = "Saving…";
  try {
    const data = await request("/api/settings/downloads", {
      method: "POST",
      body: JSON.stringify({ downloadsDir: downloadsDir.value })
    });
    downloadsDir.value = data.downloadsDir;
    downloadsStatus.textContent = data.downloadsDir;
    downloadsMessage.textContent = "Saved.";
  } catch (error) {
    downloadsMessage.textContent = error.message;
  }
});

checkUpdatesButton.addEventListener("click", async () => {
  updatesMessage.textContent = "Checking…";
  checkUpdatesButton.disabled = true;
  try {
    const data = await request("/api/settings/updates", { method: "POST" });
    renderUpdateStatus(data);
    updatesMessage.textContent = data.hasUpdate
      ? `Version ${data.latestVersion} is ready.`
      : "You have the latest version.";
  } catch (error) {
    updatesMessage.textContent = error.message;
    await loadUpdateStatus();
  } finally {
    checkUpdatesButton.disabled = false;
  }
});

clearQueueButton.addEventListener("click", async () => {
  queueMessage.textContent = "Clearing queue...";
  try {
    const data = await request("/api/jobs", { method: "DELETE" });
    queueMessage.textContent = data.keptActive > 0
      ? `Removed ${data.removed} item(s). ${data.keptActive} active download(s) stayed.`
      : `Removed ${data.removed} item(s).`;
    await refresh();
  } catch (error) {
    queueMessage.textContent = error.message;
  }
});

clearHistoryButton.addEventListener("click", async () => {
  historyMessage.textContent = "Clearing history...";
  try {
    const data = await request("/api/history", { method: "DELETE" });
    historyMessage.textContent = `Removed ${data.removed} history item(s).`;
    await refresh();
  } catch (error) {
    historyMessage.textContent = error.message;
  }
});

/* ── Schedule controls ───────────────────────────────────────── */

function updateScheduleControls() {
  const value = syncInterval.value;
  scheduleExtra.hidden = value !== "custom-interval" && value !== "daily-time";
  customIntervalField.hidden = value !== "custom-interval";
  dailyTimeField.hidden = value !== "daily-time";
}

syncInterval.addEventListener("change", updateScheduleControls);

playlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = playlistForm.querySelector("[type=submit]");
  playlistMessage.textContent = "Fetching playlist videos… (may take a moment for large playlists)";
  submitBtn.disabled = true;

  pendingPlaylistConfig = {
    url: document.querySelector("#playlist-url").value,
    name: document.querySelector("#playlist-name").value,
    interval: syncInterval.value,
    scheduleType: syncInterval.value,
    intervalHours: document.querySelector("#custom-interval-hours").value,
    timeOfDay: document.querySelector("#sync-time").value,
    quality: document.querySelector("#playlist-quality").value,
    format: document.querySelector("#playlist-format").value,
    saveDir: document.querySelector("#playlist-save-dir").value.trim() || null
  };

  try {
    const data = await request("/api/playlists/preview", {
      method: "POST",
      body: JSON.stringify({ url: pendingPlaylistConfig.url })
    });
    playlistMessage.textContent = "";
    openPreviewModal(data.videos);
  } catch (error) {
    playlistMessage.textContent = error.message;
    pendingPlaylistConfig = null;
  } finally {
    submitBtn.disabled = false;
  }
});

updateScheduleControls();
refresh();
setInterval(refresh, 1200);
