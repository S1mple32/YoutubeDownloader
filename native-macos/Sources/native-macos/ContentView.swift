import SwiftUI

struct ContentView: View {
    @ObservedObject var state: AppState

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(spacing: 18) {
                    notice
                    forms
                    lists
                    history
                }
                .padding(24)
            }
        }
        .frame(minWidth: 1180, minHeight: 820)
        .background(Color(red: 0.96, green: 0.97, blue: 0.98))
    }

    private var header: some View {
        HStack(spacing: 14) {
            LogoView(size: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text("Native macOS preview")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(red: 0.06, green: 0.46, blue: 0.43))
                    .textCase(.uppercase)
                Text("YtMark1")
                    .font(.system(size: 34, weight: .heavy))
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("Bundled downloader")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.secondary)
                Text("yt-dlp + ffmpeg ship inside the app")
                    .font(.system(size: 13, weight: .semibold))
            }
        }
        .padding(24)
    }

    private var notice: some View {
        Text("This native rewrite keeps the downloader self-contained: the app bundle carries its own downloader resources instead of asking the user to install Node.js or yt-dlp separately.")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color(red: 0.34, green: 0.26, blue: 0.06))
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white.opacity(0.92))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color(red: 0.96, green: 0.62, blue: 0.04), lineWidth: 1.5)
            )
    }

    private var forms: some View {
        HStack(alignment: .top, spacing: 18) {
            Panel(title: "Download", subtitle: "Add a video link") {
                VStack(alignment: .leading, spacing: 14) {
                    LabeledField("Video URL", text: $state.videoURL, placeholder: "https://www.youtube.com/watch?v=...")
                    HStack(spacing: 12) {
                        PickerField("Quality", selection: $state.selectedQuality, items: DownloadQuality.allCases)
                        PickerField("Format", selection: $state.selectedFormat, items: DownloadFormat.allCases)
                    }
                    Toggle("I have rights or permission to download this media.", isOn: $state.permissionConfirmed)
                    Button("Add to queue") {
                        state.addQueuedJob()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.06, green: 0.58, blue: 0.53))
                }
            }

            Panel(title: "Settings", subtitle: "Bundled app controls") {
                VStack(alignment: .leading, spacing: 14) {
                    SettingRow(label: "Current version", value: state.currentVersion)
                    SettingRow(label: "Latest release", value: state.latestVersion)
                    SettingRow(label: "Update status", value: state.updateStatus)
                    HStack(spacing: 10) {
                        Button("Check for updates") {
                            state.checkForUpdates()
                        }
                        .buttonStyle(.bordered)

                        Button("Clear queue") {
                            state.clearQueue()
                        }
                        .buttonStyle(.bordered)

                        Button("Clear history") {
                            state.clearHistory()
                        }
                        .buttonStyle(.bordered)
                    }
                    Divider()
                    LabeledField("Download folder", text: $state.downloadsFolder, placeholder: "/Users/shared/Downloads/YtMark1")
                    SettingRow(label: "Cookies", value: state.cookiesStatus)
                }
            }
        }
    }

    private var lists: some View {
        HStack(alignment: .top, spacing: 18) {
            Panel(title: "Queue", subtitle: "\(state.jobs.count) item(s)") {
                VStack(spacing: 12) {
                    ForEach(state.jobs) { job in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(job.source)
                                    .font(.system(size: 14, weight: .bold))
                                Spacer()
                                Text(job.status.capitalized)
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundStyle(Color(red: 0.06, green: 0.46, blue: 0.43))
                            }
                            Text(job.url)
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                            ProgressView(value: job.progress)
                                .tint(Color(red: 0.06, green: 0.58, blue: 0.53))
                            Text(job.message)
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(panelCard)
                    }
                }
            }

            Panel(title: "Playlists", subtitle: "\(state.playlists.count) synced") {
                VStack(alignment: .leading, spacing: 12) {
                    LabeledField("Playlist URL", text: $state.playlistURL, placeholder: "https://www.youtube.com/playlist?list=...")
                    LabeledField("Name", text: $state.playlistName, placeholder: "My channel uploads")
                    PickerField("Sync", selection: $state.selectedSchedule, items: SyncSchedule.allCases)
                    if state.selectedSchedule == .customInterval {
                        Stepper("Every \(state.customIntervalHours) hour(s)", value: $state.customIntervalHours, in: 1...168)
                    }
                    if state.selectedSchedule == .specificTime {
                        LabeledField("At", text: $state.syncTime, placeholder: "09:00")
                    }
                    Button("Sync playlist") {
                        state.addPlaylist()
                    }
                    .buttonStyle(.bordered)

                    ForEach(state.playlists) { playlist in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(playlist.name)
                                .font(.system(size: 14, weight: .bold))
                            Text("\(playlist.source) · \(playlist.url)")
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                            Text("Items \(playlist.itemsFound) · New \(playlist.newItems) · \(playlist.interval)")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(panelCard)
                    }
                }
            }
        }
    }

    private var history: some View {
        Panel(title: "History", subtitle: "\(state.history.count) saved") {
            VStack(spacing: 12) {
                ForEach(state.history) { item in
                    HStack {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("\(item.source) · \(item.quality) / \(item.format)")
                                .font(.system(size: 13, weight: .bold))
                            Text(item.output)
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(item.completedAt)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(red: 0.06, green: 0.46, blue: 0.43))
                    }
                    .padding(14)
                    .background(panelCard)
                }
            }
        }
    }

    private var panelCard: some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color(red: 0.985, green: 0.99, blue: 1.0))
    }
}

private struct Panel<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(red: 0.06, green: 0.46, blue: 0.43))
                    .textCase(.uppercase)
                Text(subtitle)
                    .font(.system(size: 20, weight: .heavy))
            }
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.94))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.black.opacity(0.06), lineWidth: 1)
        )
    }
}

private struct LabeledField: View {
    let label: String
    @Binding var text: String
    let placeholder: String

    init(_ label: String, text: Binding<String>, placeholder: String) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.secondary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

private struct SettingRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 13, weight: .semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PickerField<Item: Identifiable & Hashable & RawRepresentable>: View where Item.RawValue == String {
    let label: String
    @Binding var selection: Item
    let items: [Item]

    init(_ label: String, selection: Binding<Item>, items: [Item]) {
        self.label = label
        self._selection = selection
        self.items = items
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.secondary)
            Picker(label, selection: $selection) {
                ForEach(items) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
