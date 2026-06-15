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

    await writeUpdateCheckState({ ...state, lastCheckedDate: today, currentVersion: VERSION });
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

    let stdout = '';
    npm.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });

    npm.on('close', (code) => {
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

async function getLatestPackageVersion(): Promise<string> {
  const stdout = await runCommandOutput("npm", ["view", PACKAGE_NAME, "version", "--silent"]);
  const version = stdout.trim();
  if (!version) throw new Error("npm view 没有返回最新版本号");
  return version;
}

function runCommandOutput(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} 执行失败，退出码 ${String(code)}${stderr ? `：${stderr.trim()}` : ""}`));
    });
  });
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
