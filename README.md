# YtMark1

A Docker-based video download and playlist sync manager with a clean web UI.

![Docker](https://img.shields.io/badge/Docker-ready-blue) ![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-green) ![Node](https://img.shields.io/badge/Node-20-brightgreen)

## Features

- **Web UI** — download queue, playlist sync, history, and settings all in the browser
- **Dark mode** — toggle between light and dark, respects your OS preference, persists across reloads
- **YouTube support** — downloads via `yt-dlp` with cookie-based auth to bypass rate limits
- **Quality options** — Best, 4K/2160p, 1080p, 720p, Audio only
- **Format options** — Fast native, MP4, WebM, MP3
- **Concurrent fragments** — faster downloads with parallel chunk fetching
- **Playlist sync** — schedule playlists to sync every 3h, 6h, 24h, or at a custom time
- **Cookies upload** — paste your `cookies.txt` from the UI, no server access needed
- **Live progress cards** — real-time download progress with percent and speed
- **Persistent state** — jobs, playlists, and history saved to `data/app-state.json`
- **Settings drawer** — tabbed panel (Updates · Cookies · Storage) with status indicators
- **Health endpoint** — `GET /health` for container health checks

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

## API

```bash
# Status
curl http://localhost:3002/api/status

# Queue a download
curl -X POST http://localhost:3002/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/VIDEO_ID","quality":"1080p","format":"mp4","permissionConfirmed":true}'

# List jobs
curl http://localhost:3002/api/jobs

# Sync a playlist
curl -X POST http://localhost:3002/api/playlists/sync \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=LIST_ID","name":"My playlist","interval":"6h"}'

# Download history
curl http://localhost:3002/api/history
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
