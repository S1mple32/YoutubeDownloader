import SwiftUI

@main
struct YtMark1NativeApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup("YtMark1 Native") {
            ContentView(state: state)
        }
        .windowResizability(.contentSize)

        Settings {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    LogoView(size: 42)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("YtMark1 Native")
                            .font(.system(size: 18, weight: .heavy))
                        Text("Bundled downloader preview")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                Text("This native rewrite is being shaped to carry yt-dlp and ffmpeg inside the app bundle, so users do not install them separately.")
                    .font(.system(size: 13))
            }
            .padding(20)
            .frame(width: 420)
        }
    }
}
