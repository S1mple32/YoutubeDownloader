const { spawnSync } = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const isWindows = process.platform === "win32";
const pythonCandidates = isWindows ? ["py", "python", "python3"] : ["python3", "python"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function findPython() {
  for (const candidate of pythonCandidates) {
    const args = candidate === "py" ? ["-3", "--version"] : ["--version"];
    const result = spawnSync(candidate, args, { stdio: "ignore" });

    if (result.status === 0) {
      return candidate;
    }
  }

  throw new Error("Python 3 is required to install yt-dlp and ffmpeg helpers.");
}

function venvPython(venvDir) {
  return isWindows
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");
}

function downloaderBinary(venvDir) {
  return isWindows
    ? path.join(venvDir, "Scripts", "yt-dlp.exe")
    : path.join(venvDir, "bin", "yt-dlp");
}

function toolsDir(root) {
  return path.join(root, "tools");
}

function managedDownloaderBinary(root) {
  return isWindows
    ? path.join(toolsDir(root), "yt-dlp.exe")
    : path.join(toolsDir(root), "yt-dlp");
}

function managedFfmpegBinary(root) {
  return isWindows
    ? path.join(toolsDir(root), "ffmpeg.exe")
    : path.join(toolsDir(root), "ffmpeg");
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "YtMark1/1.2.1"
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        download(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

function ensureExecutable(filePath) {
  if (isWindows || !fs.existsSync(filePath)) {
    return;
  }

  fs.chmodSync(filePath, 0o755);
}

function findExtractedFile(root, filename) {
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
        return entryPath;
      }
    }
  }

  return null;
}

async function installManagedBinaries(root) {
  const targetToolsDir = toolsDir(root);
  const ytDlpPath = managedDownloaderBinary(root);
  const ffmpegPath = managedFfmpegBinary(root);

  fs.mkdirSync(targetToolsDir, { recursive: true });

  if (!fs.existsSync(ytDlpPath)) {
    await download(
      isWindows
        ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
      ytDlpPath
    );
    ensureExecutable(ytDlpPath);
  }

  if (!fs.existsSync(ffmpegPath)) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ytmark1-tools-"));

    try {
      const archivePath = path.join(tempRoot, isWindows ? "ffmpeg.zip" : "ffmpeg.zip");
      await download(
        isWindows
          ? "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
          : "https://evermeet.cx/ffmpeg/getrelease/zip",
        archivePath
      );

      const extractDir = path.join(tempRoot, "extract");
      fs.mkdirSync(extractDir, { recursive: true });

      if (isWindows) {
        run("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
        ]);
      } else {
        run("/usr/bin/ditto", ["-x", "-k", archivePath, extractDir]);
      }

      const extracted = findExtractedFile(extractDir, isWindows ? "ffmpeg.exe" : "ffmpeg");
      if (!extracted) {
        throw new Error("Could not find ffmpeg in the downloaded archive");
      }

      fs.copyFileSync(extracted, ffmpegPath);
      ensureExecutable(ffmpegPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  return {
    downloaderPath: ytDlpPath,
    ffmpegPath
  };
}

async function installDependencies(options = {}) {
  const root = path.resolve(options.installRoot || process.env.YTMARK1_INSTALL_ROOT || path.resolve(__dirname, ".."));
  const venvDir = path.join(root, ".venv");
  const managedDownloader = managedDownloaderBinary(root);
  const managedFfmpeg = managedFfmpegBinary(root);

  if (options.skipIfPresent && fs.existsSync(managedDownloader) && fs.existsSync(managedFfmpeg)) {
    return { managed: true, skipped: true, downloaderPath: managedDownloader, ffmpegPath: managedFfmpeg };
  }

  fs.mkdirSync(root, { recursive: true });

  try {
    const managed = await installManagedBinaries(root);
    return { managed: true, skipped: false, ...managed };
  } catch (managedError) {
    const python = findPython();
    const venvPythonPath = venvPython(venvDir);

    if (!fs.existsSync(venvPythonPath)) {
      const venvArgs = python === "py" ? ["-3", "-m", "venv", venvDir] : ["-m", "venv", venvDir];
      run(python, venvArgs);
    }

    run(venvPythonPath, ["-m", "pip", "install", "--upgrade", "pip"]);
    run(venvPythonPath, ["-m", "pip", "install", "--upgrade", "yt-dlp", "imageio-ffmpeg"]);

    return {
      managed: false,
      skipped: false,
      venvDir,
      downloaderPath: downloaderBinary(venvDir),
      ffmpegPath: null,
      fallbackReason: managedError.message
    };
  }
}

if (require.main === module) {
  installDependencies()
    .then(() => {
      console.log("YtMark1 desktop dependencies installed.");
    })
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exit(1);
    });
}

module.exports = {
  installDependencies,
  managedDownloaderBinary,
  managedFfmpegBinary
};
