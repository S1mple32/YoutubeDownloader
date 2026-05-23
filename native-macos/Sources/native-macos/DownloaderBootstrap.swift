import Foundation

enum DownloaderBootstrapError: LocalizedError {
    case missingApplicationSupportDirectory
    case missingExtractedBinary(String)

    var errorDescription: String? {
        switch self {
        case .missingApplicationSupportDirectory:
            return "Could not resolve the Application Support folder."
        case .missingExtractedBinary(let name):
            return "Could not locate \(name) after extraction."
        }
    }
}

enum DownloaderBootstrap {
    private static let ytDlpURL = URL(string: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos")!
    private static let ffmpegZipURL = URL(string: "https://evermeet.cx/ffmpeg/getrelease/zip")!

    static func prepareTools() async throws -> String {
        let fileManager = FileManager.default
        guard let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw DownloaderBootstrapError.missingApplicationSupportDirectory
        }

        let toolsDirectory = appSupport
            .appendingPathComponent("YtMark1Native", isDirectory: true)
            .appendingPathComponent("Tools", isDirectory: true)

        try fileManager.createDirectory(at: toolsDirectory, withIntermediateDirectories: true)

        let ytDlpPath = toolsDirectory.appendingPathComponent("yt-dlp")
        let ffmpegPath = toolsDirectory.appendingPathComponent("ffmpeg")

        if !fileManager.fileExists(atPath: ytDlpPath.path()) {
            try await downloadBinary(from: ytDlpURL, to: ytDlpPath)
        }

        if !fileManager.fileExists(atPath: ffmpegPath.path()) {
            try await installFfmpeg(from: ffmpegZipURL, into: toolsDirectory)
        }

        return "Bundled tools ready in \(toolsDirectory.path())"
    }

    private static func downloadBinary(from sourceURL: URL, to destinationURL: URL) async throws {
        let (temporaryURL, _) = try await URLSession.shared.download(from: sourceURL)
        try FileManager.default.removeItemIfPresent(at: destinationURL)
        try FileManager.default.moveItem(at: temporaryURL, to: destinationURL)
        try makeExecutable(at: destinationURL)
    }

    private static func installFfmpeg(from sourceURL: URL, into toolsDirectory: URL) async throws {
        let (temporaryURL, _) = try await URLSession.shared.download(from: sourceURL)
        let extractionRoot = toolsDirectory.appendingPathComponent("ffmpeg-extract", isDirectory: true)
        try FileManager.default.removeItemIfPresent(at: extractionRoot)
        try FileManager.default.createDirectory(at: extractionRoot, withIntermediateDirectories: true)

        try shell("/usr/bin/ditto", ["-x", "-k", temporaryURL.path(), extractionRoot.path()])

        guard let ffmpegBinary = FileManager.default.enumerator(at: extractionRoot, includingPropertiesForKeys: nil)?
            .compactMap({ $0 as? URL })
            .first(where: { $0.lastPathComponent == "ffmpeg" }) else {
            throw DownloaderBootstrapError.missingExtractedBinary("ffmpeg")
        }

        let target = toolsDirectory.appendingPathComponent("ffmpeg")
        try FileManager.default.removeItemIfPresent(at: target)
        try FileManager.default.copyItem(at: ffmpegBinary, to: target)
        try makeExecutable(at: target)
        try FileManager.default.removeItemIfPresent(at: extractionRoot)
    }

    private static func makeExecutable(at url: URL) throws {
        var permissions = (try FileManager.default.attributesOfItem(atPath: url.path())[.posixPermissions] as? NSNumber)?.intValue ?? 0o644
        permissions |= 0o111
        try FileManager.default.setAttributes([.posixPermissions: permissions], ofItemAtPath: url.path())
    }

    private static func shell(_ launchPath: String, _ arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: launchPath)
        process.arguments = arguments
        try process.run()
        process.waitUntilExit()

        if process.terminationStatus != 0 {
            throw NSError(domain: "YtMark1Native.DownloaderBootstrap", code: Int(process.terminationStatus))
        }
    }
}

private extension FileManager {
    func removeItemIfPresent(at url: URL) throws {
        if fileExists(atPath: url.path()) {
            try removeItem(at: url)
        }
    }
}
