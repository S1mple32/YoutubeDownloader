const { spawnSync } = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const toolsDir = path.join(projectRoot, "build", "win-tools");
const ytDlpPath = path.join(toolsDir, "yt-dlp.exe");
const ffmpegPath = path.join(toolsDir, "ffmpeg.exe");

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        "User-Agent": "YtMark1/1.2.5"
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

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function findFile(root, fileName) {
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
        return entryPath;
      }
    }
  }

  return null;
}

async function prepareWinTools() {
  fs.mkdirSync(toolsDir, { recursive: true });

  if (!fs.existsSync(ytDlpPath)) {
    await download("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", ytDlpPath);
  }

  if (!fs.existsSync(ffmpegPath)) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ytmark1-win-tools-"));
    const archivePath = path.join(tempRoot, "ffmpeg.zip");
    const extractDir = path.join(tempRoot, "extract");

    try {
      await download("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip", archivePath);
      fs.mkdirSync(extractDir, { recursive: true });

      if (process.platform === "win32") {
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

      const extractedFfmpeg = findFile(extractDir, "ffmpeg.exe");
      if (!extractedFfmpeg) {
        throw new Error("Could not find ffmpeg.exe in the downloaded archive.");
      }

      fs.copyFileSync(extractedFfmpeg, ffmpegPath);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  console.log("Windows downloader tools are ready for the installer.");
}

prepareWinTools().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
