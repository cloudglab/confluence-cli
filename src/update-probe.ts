import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { isRecord } from "./core/value.js";
import { VERSION } from "./version.js";

const PACKAGE_NAME = "@cloudglab/confluence-cli";
const CHECK_FILE = path.join(homedir(), ".confluence", "update-check.json");
const SKIP_COMMANDS = new Set(["help", "list", "version", "install", "update", "upgrade", "uninstall", "remove", "--help", "-h", "--version", "-v"]);

interface UpdateCheckState {
  lastCheckedDate?: string;
  latestVersion?: string;
  currentVersion?: string;
}

export async function runDailyUpdateProbe(commandName?: string): Promise<void> {
  if (!commandName || SKIP_COMMANDS.has(commandName)) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.CONFLUENCE_SKIP_UPDATE_CHECK === "true") return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const state = await readUpdateCheckState();
    notifyIfUpdateAvailable(state.latestVersion);

    if (state.lastCheckedDate === today) return;

    // 不在后台 check 启动前就写 lastCheckedDate:让子进程成功(code 0)后再落盘,
    // 避免 npm 失败/挂起却标记今日已检查,导致整天不再重试。
    triggerBackgroundVersionCheck();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Confluence CLI 自动更新检查失败，已继续执行当前命令：${message}\n`);
  }
}

export async function writeUpdateCacheAfterInstall(version?: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await writeUpdateCheckState({
    lastCheckedDate: today,
    latestVersion: version ?? VERSION,
    currentVersion: VERSION,
  });
}

function notifyIfUpdateAvailable(latestVersion?: string): void {
  if (!latestVersion || !isNewerVersion(latestVersion, VERSION)) return;

  process.stderr.write([
    `检测到 Confluence CLI 新版本 ${latestVersion}（当前 ${VERSION}）。`,
    "建议执行以下命令完成更新：",
    "  confluence update",
    "如只更新工具且跳过配置校验，可执行：",
    "  confluence update --skip-config-check",
    "",
  ].join("\n"));
}

async function readUpdateCheckState(): Promise<UpdateCheckState> {
  try {
    const parsed = JSON.parse(await readFile(CHECK_FILE, "utf8")) as unknown;
    if (!isRecord(parsed)) return {};
    return parsed as UpdateCheckState;
  } catch {
    return {};
  }
}

async function writeUpdateCheckState(state: UpdateCheckState): Promise<void> {
  await mkdir(path.dirname(CHECK_FILE), { recursive: true, mode: 0o700 });
  await writeFile(CHECK_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function triggerBackgroundVersionCheck(): void {
  const script = `
    const { spawn } = require('child_process');
    const { mkdirSync, writeFileSync } = require('fs');
    const { homedir } = require('os');
    const path = require('path');

    const packageName = ${JSON.stringify(PACKAGE_NAME)};
    const cliVersion = ${JSON.stringify(VERSION)};
    const shell = ${process.platform === "win32"};

    const npm = spawn('npm', ['view', packageName, 'version', '--silent'], {
      shell,
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    // 30s 兜底超时:npm view 可能因网络问题无限挂起,超时后 SIGKILL 强杀,
    // 让子进程及时退出,避免堆积。
    const timeout = setTimeout(() => { try { npm.kill('SIGKILL'); } catch {} }, 30_000);
    timeout.unref();

    let stdout = '';
    npm.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });

    npm.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) return;
      const latestVersion = stdout.trim();
      if (!latestVersion) return;
      const today = new Date().toISOString().slice(0, 10);
      const checkFile = path.join(homedir(), '.confluence', 'update-check.json');
      mkdirSync(path.dirname(checkFile), { recursive: true, mode: 0o700 });
      writeFileSync(checkFile, JSON.stringify({ lastCheckedDate: today, latestVersion, currentVersion: cliVersion }, null, 2) + '\n', { mode: 0o600 });
    });
  `;

  const child = spawn(process.execPath, ["-e", script], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
  const latest = parseVersion(latestVersion);
  const current = parseVersion(currentVersion);
  for (let index = 0; index < Math.max(latest.length, current.length); index += 1) {
    const latestPart = latest[index] ?? 0;
    const currentPart = current[index] ?? 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }
  return false;
}

function parseVersion(version: string): number[] {
  return version.replace(/^v/, "").split(/[.-]/).map((part) => Number.parseInt(part, 10)).map((part) => (Number.isFinite(part) ? part : 0));
}
