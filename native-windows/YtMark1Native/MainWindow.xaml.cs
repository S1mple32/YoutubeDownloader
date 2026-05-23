using System.Windows;
using YtMark1Native.Models;

namespace YtMark1Native;

public partial class MainWindow : Window
{
    private MainViewModel ViewModel => (MainViewModel)DataContext;

    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();
    }

    private void QueueDownload_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.QueueDownload();
    }

    private void SyncPlaylist_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.AddPlaylist();
    }

    private void ClearQueue_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.ClearQueue();
    }

    private void ClearHistory_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.ClearHistory();
    }

    private void CheckUpdates_Click(object sender, RoutedEventArgs e)
    {
        ViewModel.CheckUpdates();
    }
}
