# Changelog

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
- Bumped version to 1.3.4

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
