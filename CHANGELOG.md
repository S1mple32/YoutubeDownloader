# Changelog

## v1.3.8

- Version bump — Docker image rebuilt with latest dependencies

## v1.3.7

- **Max concurrent downloads** — new setting in Settings → Storage tab; limits how many downloads run simultaneously (default 3, adjustable 1–20)
- Downloads beyond the limit stay queued and start automatically when a slot opens
- `maxConcurrentDownloads` persisted in app state and exposed via `GET /api/settings/downloads`
- `POST /api/settings/downloads` now also accepts `maxConcurrentDownloads` to update the limit
- Fixed `forceDownload` flag not being passed through to queued jobs (force re-download was silently ignored)

## v1.3.6

- **Playlist preview modal** — fetches videos before adding; shows all entries with checkboxes and per-video quality/format selects
- Unchecked videos in the preview are tracked as seen (won't re-appear in future syncs) but not downloaded
- Per-video quality and format override inside the preview modal, defaulting to playlist config
- **Per-playlist save folder** — new "Save to folder" field on the playlist form; applied to every future auto-sync
- **Title-based filenames** — downloads now saved as the video title (e.g. `My Video.mp4`) instead of `UUID-My Video.mp4`
- **Skip existing files** — `--no-overwrites` added as default; yt-dlp skips if file already exists and shows "skipped" badge
- **Force re-download** — ↻ Force button on skipped job cards re-queues with `--force-overwrites`; "Force re-download" checkbox on the download form
- **Force removal** — 🗑 button on each job card removes the job and deletes its output file + partial/fragment files from disk
- **Purge all + delete files** — button in the queue header removes every job and deletes all their files (with confirmation)
- `DELETE /api/jobs/:id` — new endpoint for per-job removal with file deletion
- `DELETE /api/jobs/purge` — new endpoint for bulk removal with file deletion
- `POST /api/playlists/preview` — new endpoint for fetching playlist video list without creating the playlist

## v1.3.5

- Added inline file rename — ✎ button on each history entry renames the file on disk in place
- Added optional per-download save folder field in the download form
- `PATCH /api/history/:id` endpoint renames the output file and updates history
- `outputDir` parameter added to `POST /api/jobs` and passed through to yt-dlp and direct downloads
- Fixed EACCES cookie upload error — `secrets/` directory now gets `chmod 777` at Dockerfile build time

## v1.3.4

- Added dark mode with toggle button (☾/☀) in the topbar
- Dark mode respects OS preference and persists across reloads
- Redesigned settings as a compact tabbed drawer (Updates · Cookies · Storage)
- Color status dots in settings (green = OK, amber = warning, red = error)
- Implemented real playlist sync using `yt-dlp --flat-playlist`
- First sync records all existing videos as seen without queueing bulk downloads
- Subsequent syncs only queue videos new since the last check
- Added per-playlist quality and format settings
- Added status badge on playlist cards (syncing / synced / error)
- Inline error display on failed playlist syncs
- Added ↻ Sync button for on-demand manual re-sync per playlist
- Added ✕ delete button to remove a playlist

## v1.3.3

- Fixed YouTube "Requested format is not available" error on Docker
- Added `--js-runtimes node` and `--remote-components ejs:github` for YouTube n-challenge solver
- Fixed format selectors to include combined-format fallbacks (`b/best`)
- Fixed Dockerfile to install `yt-dlp` via `pip3` on Alpine (glibc binary incompatible with musl)
- Added ffmpeg merging support for 1080p and above

## v1.3.2 and earlier

- Initial Docker-based release
- Express HTTP server with download queue, playlist sync, and history
- yt-dlp integration for YouTube downloads
- Cookies upload via web UI
- Persistent state in `data/app-state.json`
- Health endpoint at `/health`
