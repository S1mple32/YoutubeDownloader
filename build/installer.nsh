!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
  Var InstallDownloaderTools
  Var DownloaderToolsCheckbox

  !macro customInit
    StrCpy $InstallDownloaderTools "1"
  !macroend

  !macro customPageAfterChangeDir
    PageEx custom
      PageCallbacks DownloaderToolsPageCreate DownloaderToolsPageLeave
      Caption "Downloader tools"
    PageExEnd
  !macroend

  Function DownloaderToolsPageCreate
    nsDialogs::Create 1018
    Pop $0

    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0u 0u 100% 16u "Downloader tools"
    Pop $1

    ${NSD_CreateLabel} 0u 22u 100% 28u "YtMark1 needs yt-dlp and ffmpeg to download and merge video/audio. Keeping this checked is recommended."
    Pop $1

    ${NSD_CreateCheckbox} 0u 60u 100% 18u "Install yt-dlp and ffmpeg (recommended)"
    Pop $DownloaderToolsCheckbox

    ${If} $InstallDownloaderTools == "1"
      ${NSD_Check} $DownloaderToolsCheckbox
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function DownloaderToolsPageLeave
    ${NSD_GetState} $DownloaderToolsCheckbox $InstallDownloaderTools
  FunctionEnd

  !macro customInstall
    ${If} $InstallDownloaderTools == "1"
      InitPluginsDir
      CreateDirectory "$APPDATA\YtMark1\tools"
      CreateDirectory "$INSTDIR\resources\tools"
      File /oname=$PLUGINSDIR\yt-dlp.exe "${PROJECT_DIR}\build\win-tools\yt-dlp.exe"
      File /oname=$PLUGINSDIR\ffmpeg.exe "${PROJECT_DIR}\build\win-tools\ffmpeg.exe"

      DetailPrint "Installing yt-dlp and ffmpeg..."
      ClearErrors
      CopyFiles /SILENT "$PLUGINSDIR\yt-dlp.exe" "$APPDATA\YtMark1\tools\yt-dlp.exe"
      CopyFiles /SILENT "$PLUGINSDIR\ffmpeg.exe" "$APPDATA\YtMark1\tools\ffmpeg.exe"

      ${If} ${Errors}
        MessageBox MB_ICONEXCLAMATION|MB_OK "YtMark1 was installed, but setup could not copy yt-dlp and ffmpeg to AppData. Open YtMark1 while connected to the internet and it will try again."
      ${EndIf}
    ${EndIf}
  !macroend
!endif
