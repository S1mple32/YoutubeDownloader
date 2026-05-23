using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using YtMark1Native.Services;

namespace YtMark1Native.Models;

public class BindableBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        return true;
    }
}

public sealed class JobRecord
{
    public string Source { get; set; } = "";
    public string Url { get; set; } = "";
    public string Quality { get; set; } = "";
    public string Format { get; set; } = "";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
    public int Progress { get; set; }
}

public sealed class PlaylistRecord
{
    public string Name { get; set; } = "";
    public string Source { get; set; } = "";
    public string Url { get; set; } = "";
    public string Schedule { get; set; } = "";
    public string LastSync { get; set; } = "";
    public string NextSync { get; set; } = "";
}

public sealed class HistoryRecord
{
    public string Title { get; set; } = "";
    public string Output { get; set; } = "";
    public string CompletedAt { get; set; } = "";
}

public sealed class MainViewModel : BindableBase
{
    private string _videoUrl = "";
    private string _playlistUrl = "";
    private string _playlistName = "";
    private string _downloadsFolder = @"C:\YtMark1\Downloads";
    private string _currentVersion = "1.2.3";
    private string _latestVersion = "1.2.3";
    private string _updateStatus = "Not checked yet";
    private string _cookiesStatus = "Bundled app storage only";
    private string _downloaderStatus = "Preparing bundled downloader tools...";
    private bool _permissionConfirmed;
    private string _selectedQuality = "1080p";
    private string _selectedFormat = "Fast native";
    private string _selectedSchedule = "Every 6 hours";

    public MainViewModel()
    {
        Jobs = new ObservableCollection<JobRecord>
        {
            new()
            {
                Source = "YouTube",
                Url = "https://youtube.com/watch?v=example",
                Quality = "1080p",
                Format = "Fast native",
                Status = "downloading",
                Message = "Native Windows rewrite will call bundled yt-dlp from the app install.",
                Progress = 67
            }
        };

        Playlists = new ObservableCollection<PlaylistRecord>
        {
            new()
            {
                Name = "Uploads",
                Source = "YouTube",
                Url = "https://youtube.com/playlist?list=demo",
                Schedule = "Every 6 hours",
                LastSync = "Today 09:00",
                NextSync = "Today 15:00"
            }
        };

        History = new ObservableCollection<HistoryRecord>
        {
            new()
            {
                Title = "YouTube · 1080p / Fast native",
                Output = "Episode_01.mp4",
                CompletedAt = "Today 08:42"
            }
        };
    }

    public ObservableCollection<JobRecord> Jobs { get; }
    public ObservableCollection<PlaylistRecord> Playlists { get; }
    public ObservableCollection<HistoryRecord> History { get; }

    public List<string> QualityOptions { get; } = ["Best available", "4K only / 2160p", "4K / 2160p", "1080p", "720p", "Audio only"];
    public List<string> FormatOptions { get; } = ["Fast native", "MP4", "WebM", "MP3"];
    public List<string> ScheduleOptions { get; } = ["Manual", "Every 3 hours", "Every 6 hours", "Daily", "Custom interval", "Specific time"];

    public string VideoUrl { get => _videoUrl; set => SetProperty(ref _videoUrl, value); }
    public string PlaylistUrl { get => _playlistUrl; set => SetProperty(ref _playlistUrl, value); }
    public string PlaylistName { get => _playlistName; set => SetProperty(ref _playlistName, value); }
    public string DownloadsFolder { get => _downloadsFolder; set => SetProperty(ref _downloadsFolder, value); }
    public string CurrentVersion { get => _currentVersion; set => SetProperty(ref _currentVersion, value); }
    public string LatestVersion { get => _latestVersion; set => SetProperty(ref _latestVersion, value); }
    public string UpdateStatus { get => _updateStatus; set => SetProperty(ref _updateStatus, value); }
    public string CookiesStatus { get => _cookiesStatus; set => SetProperty(ref _cookiesStatus, value); }
    public string DownloaderStatus { get => _downloaderStatus; set => SetProperty(ref _downloaderStatus, value); }
    public bool PermissionConfirmed { get => _permissionConfirmed; set => SetProperty(ref _permissionConfirmed, value); }
    public string SelectedQuality { get => _selectedQuality; set => SetProperty(ref _selectedQuality, value); }
    public string SelectedFormat { get => _selectedFormat; set => SetProperty(ref _selectedFormat, value); }
    public string SelectedSchedule { get => _selectedSchedule; set => SetProperty(ref _selectedSchedule, value); }

    public void QueueDownload()
    {
        if (string.IsNullOrWhiteSpace(VideoUrl))
        {
            return;
        }

        Jobs.Insert(0, new JobRecord
        {
            Source = "YouTube",
            Url = VideoUrl,
            Quality = SelectedQuality,
            Format = SelectedFormat,
            Status = "queued",
            Message = "Queued in native Windows shell",
            Progress = 0
        });

        VideoUrl = "";
        PermissionConfirmed = false;
    }

    public void AddPlaylist()
    {
        if (string.IsNullOrWhiteSpace(PlaylistUrl))
        {
            return;
        }

        Playlists.Insert(0, new PlaylistRecord
        {
            Name = string.IsNullOrWhiteSpace(PlaylistName) ? "New playlist" : PlaylistName,
            Source = "YouTube",
            Url = PlaylistUrl,
            Schedule = SelectedSchedule,
            LastSync = "Pending",
            NextSync = "Scheduled"
        });

        PlaylistUrl = "";
        PlaylistName = "";
    }

    public void ClearQueue()
    {
        for (var index = Jobs.Count - 1; index >= 0; index--)
        {
            if (!string.Equals(Jobs[index].Status, "downloading", StringComparison.OrdinalIgnoreCase))
            {
                Jobs.RemoveAt(index);
            }
        }
    }

    public void ClearHistory()
    {
        History.Clear();
    }

    public void CheckUpdates()
    {
        LatestVersion = "1.2.3";
        UpdateStatus = "Native rewrite scaffold is aligned with version 1.2.3.";
    }

    public async Task PrepareDownloaderAsync()
    {
        try
        {
            DownloaderStatus = await DownloaderBootstrap.PrepareToolsAsync();
        }
        catch (Exception error)
        {
            DownloaderStatus = $"Downloader setup failed: {error.Message}";
        }
    }
}
