# YtMark1 Native Windows

This is the native Windows rewrite scaffold for YtMark1.

Goals:
- Native Windows desktop UI instead of a web wrapper
- Bundled downloader dependencies inside the installed app
- Shared product design with the macOS native rewrite

Current status:
- WPF app structure and downloader-focused branding scaffolded
- Queue, playlist, settings, update-check, and history UI laid out
- Intended bundle location reserved for `yt-dlp` and `ffmpeg`

To build this project on Windows:
- Install the .NET 8 SDK
- Open the project in Visual Studio 2022 or run `dotnet build`
