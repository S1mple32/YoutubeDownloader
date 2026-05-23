const { spawnSync } = require("child_process");
const fs = require("fs");
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

function installDependencies(options = {}) {
  const root = path.resolve(options.installRoot || process.env.YTMARK1_INSTALL_ROOT || path.resolve(__dirname, ".."));
  const venvDir = path.join(root, ".venv");

  if (options.skipIfPresent && fs.existsSync(downloaderBinary(venvDir))) {
    return { venvDir, skipped: true };
  }

  fs.mkdirSync(root, { recursive: true });
  const python = findPython();
  const venvPythonPath = venvPython(venvDir);

  if (!fs.existsSync(venvPythonPath)) {
    const venvArgs = python === "py" ? ["-3", "-m", "venv", venvDir] : ["-m", "venv", venvDir];
    run(python, venvArgs);
  }

  run(venvPythonPath, ["-m", "pip", "install", "--upgrade", "pip"]);
  run(venvPythonPath, ["-m", "pip", "install", "--upgrade", "yt-dlp", "imageio-ffmpeg"]);

  return { venvDir, skipped: false };
}

if (require.main === module) {
  installDependencies();
  console.log("YtMark1 desktop dependencies installed.");
}

module.exports = { installDependencies };
