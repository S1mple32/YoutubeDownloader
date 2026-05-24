# YtMark1

A Docker-based video download and playlist sync manager with a clean web UI.

![Docker](https://img.shields.io/badge/Docker-ready-blue) ![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-green) ![Node](https://img.shields.io/badge/Node-20-brightgreen) ![Version](https://img.shields.io/badge/version-1.3.4-teal)

<img width="1332" height="829" alt="YtMark1 light mode" src="https://github.com/user-attachments/assets/145f1c7d-555d-4004-81bb-0bc0032553f6" />
<img width="1512" height="852" alt="YtMark1 dark mode" src="https://github.com/user-attachments/assets/4d0691fb-09ac-40ad-b2ef-34be06d7b5cf" />

## Features

- **Dark mode** — toggle (☾/☀) in the topbar, respects OS preference, persists across reloads
- **Download queue** — paste any YouTube URL, pick quality and format, add to queue
- **Quality options** — Best, 4K/2160p, 1080p, 720p, Audio only
- **Format options** — Fast native, MP4, WebM, MP3
- **Concurrent fragments** — faster downloads with parallel chunk fetching
- **Real playlist sync** — fetches live video lists via `yt-dlp`, tracks seen IDs, only queues new videos
- **Playlist delete** — remove a playlist and its tracked history with one click
- **Per-playlist settings** — choose quality and format per playlist
- **Cookies upload** — upload `cookies.txt` from the UI, no server access needed
- **Live progress cards** — real-time percent, speed, and status per download
- **Download history** — persistent log of completed downloads
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

Add a YouTube playlist URL and set a sync schedule. On first sync, all existing videos are recorded as seen — no bulk download. On every subsequent sync, only videos added since the last check are queued automatically.

- Use the **↻ Sync** button on any playlist card to trigger a manual sync
- Use the **✕** button to delete a playlist and its history
- Each playlist stores its own quality and format preference

## API

```bash
# Server status + version
curl http://localhost:3002/api/status

# Queue a download
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/VIDEO_ID","quality":"1080p","format":"mp4","permissionConfirmed":true}'

# List active jobs
curl http://localhost:3002/api/jobs

# Clear finished jobs
curl -X DELETE http://localhost:3002/api/jobs

# Add and sync a playlist
curl -X POST http://localhost:3002/api/playlists/sync \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=LIST_ID","name":"My playlist","interval":"6h","quality":"1080p","format":"mp4"}'

# Manually re-sync a playlist
curl -X POST http://localhost:3002/api/playlists/PLAYLIST_ID/sync

# Delete a playlist
curl -X DELETE http://localhost:3002/api/playlists/PLAYLIST_ID

# Download history
curl http://localhost:3002/api/history

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
