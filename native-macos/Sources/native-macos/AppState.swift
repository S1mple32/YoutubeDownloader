import Foundation

enum SyncSchedule: String, CaseIterable, Identifiable {
    case manual = "Manual"
    case every3Hours = "Every 3 hours"
    case every6Hours = "Every 6 hours"
    case daily = "Daily"
    case customInterval = "Custom interval"
    case specificTime = "Specific time"

    var id: String { rawValue }
}

enum DownloadFormat: String, CaseIterable, Identifiable {
    case native = "Fast native"
    case mp4 = "MP4"
    case webm = "WebM"
    case mp3 = "MP3"

    var id: String { rawValue }
}

enum DownloadQuality: String, CaseIterable, Identifiable {
    case best = "Best available"
    case fourKOnly = "4K only / 2160p"
    case fourK = "4K / 2160p"
    case hd1080 = "1080p"
    case hd720 = "720p"
    case audio = "Audio only"

    var id: String { rawValue }
}

struct DownloadJob: Identifiable {
    let id = UUID()
    var source: String
    var url: String
    var quality: DownloadQuality
    var format: DownloadFormat
    var progress: Double
    var status: String
    var message: String
}

struct PlaylistRecord: Identifiable {
    let id = UUID()
    var name: String
    var source: String
    var url: String
    var interval: String
    var itemsFound: Int
    var newItems: Int
    var lastSync: String
    var nextSync: String
}

struct HistoryRecord: Identifiable {
    let id = UUID()
    var source: String
    var quality: String
    var format: String
    var output: String
    var completedAt: String
}

@MainActor
final class AppState: ObservableObject {
    @Published var videoURL = ""
    @Published var playlistURL = ""
    @Published var playlistName = ""
    @Published var downloadsFolder = "/Users/shared/Downloads/YtMark1"
    @Published var cookiesStatus = "Not uploaded"
    @Published var downloaderStatus = "Preparing bundled downloader tools..."
    @Published var updateStatus = "Not checked yet"
    @Published var currentVersion = "1.2.5"
    @Published var latestVersion = "1.2.5"
    @Published var customIntervalHours = 3
    @Published var syncTime = "09:00"
    @Published var selectedQuality: DownloadQuality = .hd1080
    @Published var selectedFormat: DownloadFormat = .native
    @Published var selectedSchedule: SyncSchedule = .every6Hours
    @Published var permissionConfirmed = false
    @Published var jobs: [DownloadJob] = [
        DownloadJob(source: "YouTube", url: "https://youtube.com/watch?v=example", quality: .hd1080, format: .native, progress: 0.64, status: "downloading", message: "Bundled yt-dlp will run inside the native app.")
    ]
    @Published var playlists: [PlaylistRecord] = [
        PlaylistRecord(name: "Uploads", source: "YouTube", url: "https://youtube.com/playlist?list=demo", interval: "Every 6 hours", itemsFound: 24, newItems: 2, lastSync: "Today 09:00", nextSync: "Today 15:00")
    ]
    @Published var history: [HistoryRecord] = [
        HistoryRecord(source: "YouTube", quality: "1080p", format: "Fast native", output: "Episode_01.mp4", completedAt: "Today 08:42")
    ]

    func addQueuedJob() {
      guard !videoURL.isEmpty else { return }
      jobs.insert(
        DownloadJob(
          source: "YouTube",
          url: videoURL,
          quality: selectedQuality,
          format: selectedFormat,
          progress: 0,
          status: "queued",
          message: "Queued in native app shell"
        ),
        at: 0
      )
      videoURL = ""
      permissionConfirmed = false
    }

    func addPlaylist() {
      guard !playlistURL.isEmpty else { return }
      playlists.insert(
        PlaylistRecord(
          name: playlistName.isEmpty ? "New playlist" : playlistName,
          source: "YouTube",
          url: playlistURL,
          interval: selectedSchedule.rawValue,
          itemsFound: 0,
          newItems: 0,
          lastSync: "Pending",
          nextSync: selectedSchedule == .manual ? "Manual" : "Scheduled"
        ),
        at: 0
      )
      playlistURL = ""
      playlistName = ""
    }

    func clearQueue() {
      jobs.removeAll { $0.status != "downloading" }
    }

    func clearHistory() {
      history.removeAll()
    }

    func checkForUpdates() {
      updateStatus = "Checking GitHub release feed..."
      latestVersion = "1.2.5"
      updateStatus = "You are on the latest native preview."
    }

    func prepareDownloaderTools() async {
      do {
        downloaderStatus = try await DownloaderBootstrap.prepareTools()
      } catch {
        downloaderStatus = "Downloader setup failed: \(error.localizedDescription)"
      }
    }
}
