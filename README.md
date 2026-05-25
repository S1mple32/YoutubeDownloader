# YtMark1

A Docker-based video download and playlist sync manager with a clean web UI.

![Docker](https://img.shields.io/badge/Docker-ready-blue) ![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-green) ![Node](https://img.shields.io/badge/Node-20-brightgreen) ![Version](https://img.shields.io/badge/version-1.3.6-teal)

<img width="1332" height="829" alt="YtMark1 light mode" src="https://github.com/user-attachments/assets/145f1c7d-555d-4004-81bb-0bc0032553f6" />
<img width="1512" height="852" alt="YtMark1 dark mode" src="https://github.com/user-attachments/assets/4d0691fb-09ac-40ad-b2ef-34be06d7b5cf" />

## Features

- **Dark mode** — toggle (☾/☀) in the topbar, respects OS preference, persists across reloads
- **Download queue** — paste any URL, pick quality, format, and optional save folder
- **Title-based filenames** — downloaded files are named after the video title, not a UUID
- **Skip existing files** — yt-dlp skips if the file already exists; shows a "skipped" badge
- **Force re-download** — ↻ Force button on skipped jobs re-queues with overwrite; checkbox on form
- **Force removal** — 🗑 button per job removes it from the queue and deletes its file from disk
- **Purge all** — removes every queued job and deletes all their files in one click
- **Inline file rename** — click ✎ on any history entry to rename the file on disk in place
- **Custom save folder** — optional per-download and per-playlist output directory
- **Quality options** — Best, 4K/2160p, 1080p, 720p, Audio only
- **Format options** — Fast native, MP4, WebM, MP3
- **Concurrent fragments** — faster downloads with parallel chunk fetching
- **Playlist preview modal** — see all videos before adding a playlist; check/uncheck per video
- **Per-video config** — set quality and format per video inside the preview modal
- **Real playlist sync** — fetches live video lists via `yt-dlp`, tracks seen IDs, only queues new videos
- **Per-playlist save folder** — set where a playlist's downloads go; used on every auto-sync
- **Playlist delete** — remove a playlist and stop tracking it
- **Cookies upload** — upload `cookies.txt` from the Settings UI
- **Live progress cards** — real-time percent, speed, and status per download
- **Download history** — persistent log of completed downloads with rename support
- **Tabbed settings drawer** — Updates · Cookies · Storage with color status indicators
- **Health endpoint** — `GET /health` for container monitoring

## Quick Start

```bash
docker compose up --build
```

Open `http://localhost:3002`.

## Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3002:3000"
    volumes:
      - ./downloads:/app/downloads
      - ./data:/app/data
      - ./secrets:/app/secrets
    restart: unless-stopped
```

Downloads go to `./downloads`, state to `./data`, cookies to `./secrets`.

## YouTube Cookies (Recommended)

YouTube rate-limits unauthenticated server IPs. Upload your cookies to bypass this:

1. Install the **"Get cookies.txt LOCALLY"** browser extension
2. Export cookies while signed in to YouTube
3. Open Settings (⚙) → **Cookies tab** → upload the `.txt` file

Cookies are stored in `secrets/youtube-cookies.txt` inside the container.

## Playlist Sync

Click **"Preview & add playlist"** to fetch the video list first. A modal shows every video with:

- A checkbox — checked videos are downloaded immediately; unchecked are tracked as seen (won't re-appear in future syncs)
- Per-video quality and format selects, defaulting to the playlist config
- Select all / Deselect all controls

On every subsequent scheduled sync, only videos added to the playlist since the last check are automatically queued.

- **↻ Sync** — manual re-sync per playlist card
- **✕** — delete a playlist and stop tracking it
- **Save to folder** — optional output directory applied to every sync for that playlist

## File Management

| Action | How |
|--------|-----|
| Skip if file exists | Default — yt-dlp runs with `--no-overwrites` |
| Re-download existing | Click **↻ Force** on a skipped job, or check "Force re-download" on the form |
| Rename a file | Click **✎** on a history entry |
| Remove job + delete file | Click **🗑** on any job card |
| Remove all jobs + delete files | Click **Purge all + delete files** in the queue header |
| Remove jobs without touching files | Click **Clear queue** |

## API

```bash
# Server status + version
curl http://localhost:3002/api/status

# Queue a download
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/VIDEO_ID","quality":"1080p","format":"mp4","permissionConfirmed":true,"outputDir":"/custom/path","forceDownload":false}'

# List jobs
curl http://localhost:3002/api/jobs

# Remove a single job and delete its file
curl -X DELETE http://localhost:3002/api/jobs/JOB_ID

# Remove all jobs and delete their files
curl -X DELETE http://localhost:3002/api/jobs/purge

# Clear queue (jobs only, no file deletion)
curl -X DELETE http://localhost:3002/api/jobs

# Preview a playlist before adding
curl -X POST http://localhost:3002/api/playlists/preview \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=LIST_ID"}'

# Add and sync a playlist
curl -X POST http://localhost:3002/api/playlists/sync \
  -H "Content-Type: application/json" \
  -d '{"url":"...","name":"My playlist","interval":"6h","quality":"1080p","format":"mp4","saveDir":"/mnt/media","seenIds":[],"toDownload":[]}'

# Manually re-sync a playlist
curl -X POST http://localhost:3002/api/playlists/PLAYLIST_ID/sync

# Delete a playlist
curl -X DELETE http://localhost:3002/api/playlists/PLAYLIST_ID

# Download history
curl http://localhost:3002/api/history

# Rename a history entry's file on disk
curl -X PATCH http://localhost:3002/api/history/HISTORY_ID \
  -H "Content-Type: application/json" \
  -d '{"newName":"my-video.mp4"}'

# Clear history
curl -X DELETE http://localhost:3002/api/history
```

## Quality Options

| Value | Description |
|-------|-------------|
| `best` | Best available quality |
| `2160p-only` | Exactly 4K, no fallback |
| `2160p` | 4K with fallback to best |
| `1080p` | 1080p with fallback |
| `720p` | 720p with fallback |
| `audio` | Audio only (MP3) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `YTMARK1_HOME` | app dir | Root for downloads, data, secrets |
| `DOWNLOADER_BIN` | `yt-dlp` | Path to yt-dlp binary |
| `FFMPEG_BIN` | *(auto)* | Path to ffmpeg binary |
| `PORT` | `3000` | Port the server listens on |

## Important

Download or sync only media you own, created, licensed, or have explicit permission to save. YouTube links run through `yt-dlp` — use this only for videos you have the right to download.
