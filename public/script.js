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
const cookiesMessage = document.querySelector("#cookies-message");
const cookiesStatus = document.querySelector("#cookies-status");
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
const updateReleaseLink = document.querySelector("#update-release-link");
const updatesMessage = document.querySelector("#updates-message");
const syncInterval = document.querySelector("#sync-interval");
const scheduleExtra = document.querySelector("#schedule-extra");
const customIntervalField = document.querySelector("#custom-interval-field");
const dailyTimeField = document.querySelector("#daily-time-field");

function formatDate(value) {
  if (!value) {
    return "Not scheduled";
  }

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

  if (!response.ok) {
    throw new Error(data.error || data.job?.message || "Request failed");
  }

  return data;
}

function openSettings() {
  settingsModal.hidden = false;
  loadCookieStatus();
  loadDownloadSettings();
  loadUpdateStatus();
}

function closeSettings() {
  settingsModal.hidden = true;
}

function renderJobs(jobs) {
  queueCount.textContent = `${jobs.length} queued`;
  jobsEmpty.hidden = jobs.length > 0;
  jobList.innerHTML = jobs
    .map((job) => {
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
        </article>
      `;
    })
    .join("");
}

function renderPlaylists(playlists) {
  playlistCount.textContent = `${playlists.length} synced`;
  playlistsEmpty.hidden = playlists.length > 0;
  playlistList.innerHTML = playlists
    .map((playlist) => {
      return `
        <article class="playlist">
          <div>
            <strong>${escapeHtml(playlist.name)}</strong>
            <p>${escapeHtml(playlist.source)} · ${escapeHtml(playlist.url)}</p>
          </div>
          <dl>
            <div>
              <dt>Items</dt>
              <dd>${playlist.itemsFound}</dd>
            </div>
            <div>
              <dt>New</dt>
              <dd>${playlist.newItems}</dd>
            </div>
            <div>
              <dt>Last sync</dt>
              <dd>${formatDate(playlist.lastSyncAt)}</dd>
            </div>
            <div>
              <dt>Next sync</dt>
              <dd>${formatDate(playlist.nextSyncAt)}</dd>
            </div>
            <div>
              <dt>Schedule</dt>
              <dd>${escapeHtml(playlist.interval)}</dd>
            </div>
          </dl>
        </article>
      `;
    })
    .join("");
}

function renderHistory(history) {
  historyCount.textContent = `${history.length} saved`;
  historyEmpty.hidden = history.length > 0;
  historyList.innerHTML = history
    .map((entry) => {
      return `
        <article class="history-item">
          <div>
            <strong>${escapeHtml(entry.source)} · ${escapeHtml(entry.quality)} / ${escapeHtml(entry.format)}</strong>
            <p>${escapeHtml(entry.output)}</p>
          </div>
          <div>
            <span>${formatDate(entry.completedAt)}</span>
            <p>${escapeHtml(entry.url)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

async function refresh() {
  try {
    const [statusData, jobData, playlistData, historyData] = await Promise.all([
      request("/api/status"),
      request("/api/jobs"),
      request("/api/playlists"),
      request("/api/history")
    ]);

    serverState.textContent = statusData.status === "ok" ? "Online" : "Needs attention";
    cookiesStatus.textContent = statusData.cookiesConfigured ? "Cookies uploaded" : "No cookies uploaded";
    downloadsStatus.textContent = statusData.downloadsDir || "Not set";
    updateCurrentVersion.textContent = statusData.version || "Unknown";
    renderJobs(jobData.jobs);
    renderPlaylists(playlistData.playlists);
    renderHistory(historyData.history);
  } catch (error) {
    serverState.textContent = "Offline";
  }
}

function renderUpdateStatus(data) {
  updateCurrentVersion.textContent = data.currentVersion || "Unknown";
  updateLatestVersion.textContent = data.latestVersion || "Not checked yet";
  updateReleaseLink.href = data.releaseUrl || "https://github.com/S1mple32/YoutubeDownloader/releases";

  if (data.error) {
    updateStatusMessage.textContent = data.error;
    return;
  }

  if (!data.checkedAt) {
    updateStatusMessage.textContent = "Not checked yet.";
    return;
  }

  if (data.hasUpdate) {
    updateStatusMessage.textContent = `Update available: ${data.latestVersion}`;
    return;
  }

  updateStatusMessage.textContent = `You are up to date on ${formatDate(data.checkedAt)}.`;
}

downloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  downloadMessage.textContent = "Adding download...";

  try {
    const data = await request("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        url: document.querySelector("#video-url").value,
        quality: document.querySelector("#quality").value,
        format: document.querySelector("#format").value,
        permissionConfirmed: document.querySelector("#permission-confirmed").checked
      })
    });

    downloadForm.reset();
    downloadMessage.textContent = data.job.status === "blocked" ? data.job.message : "Download queued.";
    await refresh();
  } catch (error) {
    downloadMessage.textContent = error.message;
  }
});

settingsButton.addEventListener("click", openSettings);

document.querySelectorAll("[data-close-settings]").forEach((button) => {
  button.addEventListener("click", closeSettings);
});

async function loadCookieStatus() {
  try {
    const data = await request("/api/settings/cookies");
    cookiesStatus.textContent = data.configured ? `Uploaded to ${data.path}` : "No cookies uploaded";
  } catch (error) {
    cookiesStatus.textContent = "Could not check cookies";
  }
}

async function loadDownloadSettings() {
  try {
    const data = await request("/api/settings/downloads");
    downloadsDir.value = data.downloadsDir;
    downloadsStatus.textContent = data.downloadsDir;
  } catch (error) {
    downloadsStatus.textContent = "Could not check folder";
  }
}

async function loadUpdateStatus() {
  try {
    const data = await request("/api/settings/updates");
    renderUpdateStatus(data);
  } catch (error) {
    updateStatusMessage.textContent = "Could not check update status";
  }
}

cookiesForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = cookiesFile.files[0];
  if (!file) {
    cookiesMessage.textContent = "Choose a cookies.txt file first.";
    return;
  }

  cookiesMessage.textContent = "Uploading cookies...";

  try {
    const content = await file.text();
    const data = await request("/api/settings/cookies", {
      method: "POST",
      body: JSON.stringify({ content })
    });

    cookiesMessage.textContent = `Uploaded ${data.bytes} bytes.`;
    cookiesStatus.textContent = `Uploaded to ${data.path}`;
    cookiesForm.reset();
  } catch (error) {
    cookiesMessage.textContent = error.message;
  }
});

downloadsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  downloadsMessage.textContent = "Saving folder...";

  try {
    const data = await request("/api/settings/downloads", {
      method: "POST",
      body: JSON.stringify({ downloadsDir: downloadsDir.value })
    });

    downloadsDir.value = data.downloadsDir;
    downloadsStatus.textContent = data.downloadsDir;
    downloadsMessage.textContent = "Download folder saved.";
  } catch (error) {
    downloadsMessage.textContent = error.message;
  }
});

checkUpdatesButton.addEventListener("click", async () => {
  updatesMessage.textContent = "Checking for updates...";

  try {
    const data = await request("/api/settings/updates", {
      method: "POST"
    });

    renderUpdateStatus(data);
    updatesMessage.textContent = data.hasUpdate
      ? `Version ${data.latestVersion} is ready.`
      : "You already have the latest version.";
  } catch (error) {
    updatesMessage.textContent = error.message;
    await loadUpdateStatus();
  }
});

clearQueueButton.addEventListener("click", async () => {
  queueMessage.textContent = "Clearing queue...";

  try {
    const data = await request("/api/jobs", {
      method: "DELETE"
    });

    queueMessage.textContent = data.keptActive > 0
      ? `Removed ${data.removed} item(s). ${data.keptActive} active download(s) stayed in the queue.`
      : `Removed ${data.removed} item(s) from the queue.`;
    await refresh();
  } catch (error) {
    queueMessage.textContent = error.message;
  }
});

clearHistoryButton.addEventListener("click", async () => {
  historyMessage.textContent = "Clearing history...";

  try {
    const data = await request("/api/history", {
      method: "DELETE"
    });

    historyMessage.textContent = `Removed ${data.removed} history item(s).`;
    await refresh();
  } catch (error) {
    historyMessage.textContent = error.message;
  }
});

function updateScheduleControls() {
  const value = syncInterval.value;
  const showCustom = value === "custom-interval";
  const showDailyTime = value === "daily-time";

  scheduleExtra.hidden = !showCustom && !showDailyTime;
  customIntervalField.hidden = !showCustom;
  dailyTimeField.hidden = !showDailyTime;
}

syncInterval.addEventListener("change", updateScheduleControls);

playlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  playlistMessage.textContent = "Syncing playlist...";

  try {
    await request("/api/playlists/sync", {
      method: "POST",
      body: JSON.stringify({
        url: document.querySelector("#playlist-url").value,
        name: document.querySelector("#playlist-name").value,
        interval: syncInterval.value,
        scheduleType: syncInterval.value,
        intervalHours: document.querySelector("#custom-interval-hours").value,
        timeOfDay: document.querySelector("#sync-time").value
      })
    });

    playlistForm.reset();
    playlistMessage.textContent = "Playlist synced.";
    await refresh();
  } catch (error) {
    playlistMessage.textContent = error.message;
  }
});

updateScheduleControls();
refresh();
setInterval(refresh, 1200);
