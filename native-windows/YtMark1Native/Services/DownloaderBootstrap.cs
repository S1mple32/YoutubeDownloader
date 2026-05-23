using System.IO;
using System.IO.Compression;
using System.Net.Http;

namespace YtMark1Native.Services;

public static class DownloaderBootstrap
{
    private static readonly Uri YtDlpUri = new("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe");
    private static readonly Uri FfmpegZipUri = new("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip");

    public static async Task<string> PrepareToolsAsync()
    {
        var toolsDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YtMark1Native",
            "Tools"
        );

        Directory.CreateDirectory(toolsDirectory);

        var ytDlpPath = Path.Combine(toolsDirectory, "yt-dlp.exe");
        var ffmpegPath = Path.Combine(toolsDirectory, "ffmpeg.exe");

        using var client = new HttpClient();

        if (!File.Exists(ytDlpPath))
        {
            await using var ytDlpStream = await client.GetStreamAsync(YtDlpUri);
            await using var output = File.Create(ytDlpPath);
            await ytDlpStream.CopyToAsync(output);
        }

        if (!File.Exists(ffmpegPath))
        {
            var zipPath = Path.Combine(toolsDirectory, "ffmpeg-release-essentials.zip");
            await using (var zipStream = await client.GetStreamAsync(FfmpegZipUri))
            await using (var fileStream = File.Create(zipPath))
            {
                await zipStream.CopyToAsync(fileStream);
            }

            using var archive = ZipFile.OpenRead(zipPath);
            var entry = archive.Entries.FirstOrDefault(item =>
                item.FullName.EndsWith("/bin/ffmpeg.exe", StringComparison.OrdinalIgnoreCase));

            if (entry is null)
            {
                throw new FileNotFoundException("Could not locate ffmpeg.exe inside the downloaded archive.");
            }

            entry.ExtractToFile(ffmpegPath, overwrite: true);
            File.Delete(zipPath);
        }

        return $"Bundled tools ready in {toolsDirectory}";
    }
}
