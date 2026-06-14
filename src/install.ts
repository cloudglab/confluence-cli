import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ConfluenceApi } from "./api/index.js";
import { loadConfluenceConfig, normalizeConfig, saveConfig } from "./core/config.js";

const PACKAGE_NAME = "@cloudglab/confluence-cli";
const GIT_SKILL_SOURCE = "cloudglab/confluence-cli";

type SkillSource = "local" | "git" | "npm";

interface InstallOptions {
  skillSource: SkillSource;
  skillLocalPath?: string;
  skipConfigCheck: boolean;
  cliOnly: boolean;
  skillOnly: boolean;
}

export async function runInstallCommand(args: string[] = []): Promise<void> {
  const options = parseInstallOptions(args);
  await installPackageAndSkill("安装", options);
  if (options.skipConfigCheck) {
    printSuccessGuide("安装", "已跳过 Confluence 配置校验。");
    return;
  }
  await ensureValidConfluenceConfig();
  printSuccessGuide("安装", "Confluence 配置校验通过。");
}

export async function runUpdateCommand(args: string[] = []): Promise<void> {
  const options = parseInstallOptions(args);
  await installPackageAndSkill("更新", options);
  if (options.skipConfigCheck) {
    printSuccessGuide("更新", "已跳过 Confluence 配置校验。");
    return;
  }
  await ensureValidConfluenceConfig();
  printSuccessGuide("更新", "Confluence 配置校验通过。");
}

function printSuccessGuide(action: "安装" | "更新", status: string): void {
  process.stdout.write(`\n${action}完成，${status}\n\n${renderBanner()}\n\n`);
  process.stdout.write(`快速开始：
  confluence help                         查看帮助
  confluence list                         查看可用命令
  confluence searchContent --limit 10     查询页面
  confluence listRestApis --limit 20      查看 REST API 模板

常用配置：
  confluence update                       更新 CLI 和 Skill
  confluence install --skip-config-check  仅安装，跳过配置校验
  CONFLUENCE_DISABLE_WRITE=true           禁用真实写操作

写操作提示：真实写入仍需显式传 confirm=true。
`);
}

function parseInstallOptions(args: string[]): InstallOptions {
  let skillSource: SkillSource = "local";
  let skillLocalPath: string | undefined;
  let skipConfigCheck = false;
  let cliOnly = false;
  let skillOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skill-source" || arg.startsWith("--skill-source=")) {
      const value = readRequiredOptionValue(args, index, "--skill-source");
      if (value !== "local" && value !== "git" && value !== "npm") throw new Error("--skill-source 只支持 local、git 或 npm");
      skillSource = value;
      if (arg === "--skill-source") index += 1;
      continue;
    }

    if (arg === "--skill-local-path" || arg.startsWith("--skill-local-path=")) {
      skillLocalPath = readRequiredOptionValue(args, index, "--skill-local-path");
      if (arg === "--skill-local-path") index += 1;
      continue;
    }

    if (arg === "--skip-config-check" || arg.startsWith("--skip-config-check=")) {
      const parsed = readBooleanFlag(args, index, "--skip-config-check");
      skipConfigCheck = parsed.value;
      index += parsed.consumedArgs;
      continue;
    }

    if (arg === "--cli-only" || arg.startsWith("--cli-only=")) {
      const parsed = readBooleanFlag(args, index, "--cli-only");
      cliOnly = parsed.value;
      index += parsed.consumedArgs;
      continue;
    }

    if (arg === "--skill-only" || arg.startsWith("--skill-only=")) {
      const parsed = readBooleanFlag(args, index, "--skill-only");
      skillOnly = parsed.value;
      index += parsed.consumedArgs;
      continue;
    }

    throw new Error(`未知安装参数: ${arg}`);
  }

  if (cliOnly && skillOnly) throw new Error("--cli-only 和 --skill-only 不能同时使用");
  return { skillSource, skillLocalPath, skipConfigCheck, cliOnly, skillOnly };
}

function readRequiredOptionValue(args: string[], index: number, optionName: string): string {
  const arg = args[index];
  const inlineValue = readInlineOptionValue(arg, optionName);
  if (inlineValue !== undefined) {
    if (inlineValue.trim() === "") throw new Error(`${optionName} 需要传入参数值`);
    return inlineValue;
  }

  const next = args[index + 1];
  if (typeof next !== "string" || next.startsWith("--")) throw new Error(`${optionName} 需要传入参数值`);
  return next;
}

function readInlineOptionValue(arg: string, optionName: string): string | undefined {
  const prefix = `${optionName}=`;
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
}

function readBooleanFlag(args: string[], index: number, optionName: string): { value: boolean; consumedArgs: number } {
  const inlineValue = readInlineOptionValue(args[index], optionName);
  if (inlineValue !== undefined) return { value: parseBooleanValue(inlineValue, optionName), consumedArgs: 0 };

  const next = args[index + 1];
  if (typeof next === "string" && !next.startsWith("--")) {
    return { value: parseBooleanValue(next, optionName), consumedArgs: 1 };
  }

  return { value: true, consumedArgs: 0 };
}

function parseBooleanValue(value: string, optionName: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw new Error(`${optionName} 只支持 true 或 false`);
}

async function installPackageAndSkill(action: "安装" | "更新", options: InstallOptions): Promise<void> {
  if (!options.skillOnly) {
    await runStep(`${action} Confluence CLI`, "npm", ["install", "-g", `${PACKAGE_NAME}@latest`]);
  }
  if (!options.cliOnly) {
    await installSkill(action, options);
  }
}

async function installSkill(action: "安装" | "更新", options: InstallOptions): Promise<void> {
  if (options.skillLocalPath) {
    await runStep(`${action} Confluence skill`, "npx", ["-y", "skills", "add", "-g", path.resolve(options.skillLocalPath)]);
    return;
  }

  if (options.skillSource === "local") {
    await installSkillFromInstalledPackage(action);
    return;
  }

  if (options.skillSource === "git") {
    await runStep(`${action} Confluence skill`, "npx", ["-y", "skills", "add", "-g", GIT_SKILL_SOURCE]);
    return;
  }

  await installSkillFromNpmPackage(action);
}

async function installSkillFromInstalledPackage(action: "安装" | "更新"): Promise<void> {
  const skillPath = await getInstalledPackageSkillPath();
  try {
    await access(skillPath);
  } catch {
    throw new Error(`未找到已安装包内的 Confluence skill：${skillPath}。可重试 --skill-source npm 或 --skill-source git。`);
  }
  await runStep(`${action} Confluence skill`, "npx", ["-y", "skills", "add", "-g", skillPath]);
}

async function getInstalledPackageSkillPath(): Promise<string> {
  const globalNodeModules = (await runCommandOutput("npm", ["root", "-g"])).trim();
  if (!globalNodeModules) throw new Error("npm root -g 没有返回全局 node_modules 路径");
  return path.join(globalNodeModules, PACKAGE_NAME, "skills", "confluence-cli");
}

async function installSkillFromNpmPackage(action: "安装" | "更新"): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "confluence-cli-skill-"));
  try {
    const stdout = await runCommandOutput("npm", ["pack", `${PACKAGE_NAME}@latest`, "--pack-destination", tempDir, "--silent"]);
    const tarballName = stdout.trim().split("\n").filter(Boolean).at(-1);
    if (!tarballName) throw new Error("npm pack 没有返回包文件名");
    await runStep("解压 Confluence npm 包", "tar", ["-xzf", path.join(tempDir, tarballName), "-C", tempDir]);
    await runStep(`${action} Confluence skill`, "npx", ["-y", "skills", "add", "-g", path.join(tempDir, "package")]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function ensureValidConfluenceConfig(): Promise<void> {
  const config = loadConfluenceConfig();
  const api = new ConfluenceApi(config);
  await api.getCurrentUser();
  saveConfig(normalizeConfig(config));
}

async function runStep(title: string, command: string, args: string[]): Promise<void> {
  process.stdout.write(`\n${title}...\n`);
  await runCommand(command, args);
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: process.platform === "win32" });
    let stderr = "";
    child.stdout?.pipe(process.stdout);
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} 执行失败，退出码 ${String(code)}${stderr ? `：${stderr.trim()}` : ""}`));
    });
  });
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

function renderBanner(): string {
  return [
    "   ___       ___       ___       ___       ___       ___       ___       ___       ___       ___   ",
    "  /\\  \\     /\\  \\     /\\__\\     /\\  \\     /\\__\\     /\\__\\     /\\  \\     /\\__\\     /\\  \\     /\\  \\  ",
    " /::\\  \\   /::\\  \\   /:| _|_   /::\\  \\   /:/  /    /:/ _/_   /::\\  \\   /:| _|_   /::\\  \\   /::\\  \\ ",
    "/:/\\:\\__\\ /:/\\:\\__\\ /::|/\\__\\ /::\\:\\__\\ /:/__/    /:/_/\\__\\ /::\\:\\__\\ /::|/\\__\\ /:/\\:\\__\\ /::\\:\\__\\",
    "\\:\\ \\/__/ \\:\\/:/  / \\/|::/  / \\/\\:\\/__/ \\:\\  \\    \\:\\/:/  / \\:\\:\\/  / \\/|::/  / \\:\\ \\/__/ \\:\\:\\/  /",
    " \\:\\__\\    \\::/  /    |:/  /     \\/__/   \\:\\__\\    \\::/  /   \\:\\/  /    |:/  /   \\:\\__\\    \\:\\/  / ",
    "  \\/__/     \\/__/     \\/__/               \\/__/     \\/__/     \\/__/     \\/__/     \\/__/     \\/__/ ",
  ].join("\n");
}
