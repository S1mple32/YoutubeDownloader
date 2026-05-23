# YtMark1 Native macOS

This is the native macOS rewrite scaffold for YtMark1.

Goals:
- Native SwiftUI desktop app instead of a web wrapper
- Bundled downloader dependencies inside the app bundle
- Shared product design with the Windows native rewrite

Current status:
- SwiftUI app structure and downloader-focused branding scaffolded
- Queue, playlist, settings, update-check, and history UI laid out
- Reserved resources folder for bundled `yt-dlp` and `ffmpeg`

Current blocker on this machine:
- Full Xcode is not installed
- The active Apple command line toolchain and SDK do not match closely enough to compile the SwiftUI app here

To build on a Mac with the proper Apple toolchain:
- Install full Xcode
- Select it with `sudo xcode-select -s /Applications/Xcode.app`
- Build from the `native-macos` folder with Swift Package Manager or Xcode
