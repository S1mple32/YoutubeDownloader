# YtMark1


A Docker-ready and desktop-ready video download and playlist sync app.

This starter app includes:

- Allows cache cookies from Youtube to be directly uploaded from the WEB UI (i personally use "Get cookies.txt LOCALLY" addon i found it quite easy to use
- Video URL queue with quality options up to 4K / 2160p
- Direct media URL downloads saved into `downloads/`
- YouTube downloads through `yt-dlp` for videos you own or have permission to save
- Faster YouTube downloads with concurrent fragments
- Fast native format mode that avoids forcing MP4 when possible
- 4K only mode for exact 2160p downloads
- Playlist sync/import panel
- Live progress cards
- Persistent playlists, schedules, and download history in `data/app-state.json`
- JSON API endpoints
- Health endpoint at `/health`
- Production Dockerfile and Compose config
- Native desktop shell for macOS and Windows through Electron

Important: download or sync only media you own, created, licensed, or have explicit permission to save. Direct media files such as `.mp4`, `.webm`, `.mp3`, and `.m4a` are downloaded into `downloads/`. YouTube links run through `yt-dlp`; use this only for your own videos or media you have permission to download.

## Run As A Desktop App

Install Node.js with npm first, then run:

```bash
npm install
npm run desktop
```

`npm install` installs the Electron app dependencies and also creates a local `.venv` with `yt-dlp` and `ffmpeg` support. The desktop app opens in its own window and starts the local backend on a free private port automatically, so it is not locked to `3000`.

Build installers:

```bash
npm run build:mac
npm run build:win
```

Built apps are written to `release/`. Build the Windows installer on Windows for the smoothest result; macOS builds should be made on macOS.

Desktop app data, cookies, and downloads are stored in the app user-data folder by default. You can change the active download folder from Settings inside the app.

## Run Locally

```bash
node server.js
```

Open `http://localhost:3000`.

State is saved to `data/app-state.json`. Downloaded media is saved to `downloads/`.
You can change the active download folder from the app Settings panel. In Docker, use a path mounted into the container, such as `/app/downloads`, or add another volume in `compose.yaml`.

For YouTube downloads when running locally, install `yt-dlp` and `ffmpeg` first, or run `npm install` to let the desktop dependency installer create the bundled `.venv`. Docker installs them inside the image automatically.

## Run With Docker

```bash
docker compose up --build
```

Open `http://localhost:3002`.

## API

```bash
curl http://localhost:3000/api/status
curl http://localhost:3000/api/jobs
curl http://localhost:3000/api/playlists
```

Create a download job:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/video.mp4","quality":"1080p","format":"mp4","permissionConfirmed":true}'
```

Sync a playlist:

```bash
curl -X POST http://localhost:3000/api/playlists/sync \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=YOUR_LIST","name":"My playlist","interval":"6h"}'
```

## Next Production Step

Replace the simulated queue in `server.js` with a permitted media provider integration, storage volume, and background worker. For YouTube playlist metadata, use the YouTube Data API with an API key or OAuth, depending on whether playlists are public or private.
Playlist sync is still metadata-style in this starter. For real YouTube playlist metadata, use the YouTube Data API with an API key or OAuth, depending on whether playlists are public or private.
