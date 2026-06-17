import { spawn } from "node:child_process";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ConfluenceApi } from "./api/index.js";
import { loadConfluenceConfig, normalizeConfig, saveConfig } from "./core/config.js";
import { writeUpdateCacheAfterInstall } from "./update-probe.js";

const PACKAGE_NAME = "@cloudglab/confluence-cli";
const GIT_SKILL_SOURCE = "cloudglab/confluence-cli";
const MERMAID_RENDERER_PACKAGE = "beautiful-mermaid-cli";

type SkillSource = "local" | "git" | "npm";

interface InstallOptions {
  skillSource: SkillSource;
  skillLocalPath?: string;
  skillGlobal: boolean;
  skipConfigCheck: boolean;
  cliOnly: boolean;
  skillOnly: boolean;
}

interface UninstallOptions {
  confirm: boolean;
  keepConfig: boolean;
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

export async function runUninstallCommand(args: string[] = []): Promise<void> {
  const options = parseUninstallOptions(args);
  if (!options.confirm) {
    printUninstallPreview(options);
    return;
  }

  if (!options.cliOnly) {
    await uninstallSkill();
  }
  if (!options.skillOnly) {
    await uninstallPackage();
  }
  if (shouldRemoveConfig(options)) {
    await removeConfigFile();
  }

  process.stdout.write("\n卸载完成。\n");
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
  confluence install --skill-global       把 skill 装到 user-level 全局目录
  bm doctor --json                       检查 Mermaid 渲染器
  CONFLUENCE_DISABLE_WRITE=true           禁用真实写操作

写操作提示：真实写入仍需显式传 confirm=true。
`);
}

function parseInstallOptions(args: string[]): InstallOptions {
  let skillSource: SkillSource = "local";
  let skillLocalPath: string | undefined;
  let skillGlobal = false;
  let skipConfigCheck = false;
  let cliOnly = false;
  let skillOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skill-source" || arg.startsWith("--skill-source=")) {
      const value = readRequiredOptionValue(args, index, "--skill-source");
      if (value !== "local" && value !== "git" && value !== "npm") {
        throw new Error("--skill-source 只支持 local、git 或 npm");
      }
      skillSource = value;
      if (arg === "--skill-source") index += 1;
      continue;
    }

    if (arg === "--skill-local-path" || arg.startsWith("--skill-local-path=")) {
      skillLocalPath = readRequiredOptionValue(args, index, "--skill-local-path");
      if (arg === "--skill-local-path") index += 1;
      continue;
    }

    if (arg === "--skill-global" || arg.startsWith("--skill-global=")) {
      const parsed = readBooleanFlag(args, index, "--skill-global");
      skillGlobal = parsed.value;
      index += parsed.consumedArgs;
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

  if (cliOnly && skillOnly) {
    throw new Error("--cli-only 和 --skill-only 不能同时使用");
  }

  return { skillSource, skillLocalPath, skillGlobal, skipConfigCheck, cliOnly, skillOnly };
}

function parseUninstallOptions(args: string[]): UninstallOptions {
  let confirm = false;
  let keepConfig = false;
  let cliOnly = false;
  let skillOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm" || arg.startsWith("--confirm=")) {
      const parsed = readBooleanFlag(args, index, "--confirm");
      confirm = parsed.value;
      index += parsed.consumedArgs;
      continue;
    }

    if (arg === "--keep-config" || arg.startsWith("--keep-config=")) {
      const parsed = readBooleanFlag(args, index, "--keep-config");
      keepConfig = parsed.value;
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

    throw new Error(`未知卸载参数: ${arg}`);
  }

  if (cliOnly && skillOnly) {
    throw new Error("--cli-only 和 --skill-only 不能同时使用");
  }

  return { confirm, keepConfig, cliOnly, skillOnly };
}

function printUninstallPreview(options: UninstallOptions): void {
  const steps = [
    ...(!options.cliOnly ? ["卸载 confluence skill（项目级和全局级）"] : []),
    ...(!options.skillOnly ? ["卸载全局 CLI 包、清理 npm 残留目录，并卸载 Mermaid 渲染器"] : []),
    ...(shouldRemoveConfig(options) ? ["删除 ~/.confluence/config.json"] : ["保留 ~/.confluence/config.json"]),
  ];

  process.stdout.write(`卸载预览：\n${steps.map((step) => `  - ${step}`).join("\n")}\n\n真实执行请运行：\n  confluence uninstall --confirm true\n  npx -y ${PACKAGE_NAME}@latest uninstall --confirm true\n\n可选参数：\n  --keep-config true   保留 Confluence 配置\n  --cli-only true      只卸载 CLI\n  --skill-only true    只卸载 skill\n`);
}

function shouldRemoveConfig(options: UninstallOptions): boolean {
  return !options.keepConfig && !options.cliOnly && !options.skillOnly;
}

function createSkillAddArgs(source: string, global = false): string[] {
  // 默认走 vercel-labs/skills 推荐的项目级（cwd 下 agent skills 目录），
  // 兼容所有 agent（包括不支持 --global 的，如 PromptScript）。
  // 用户明确需要 user-level 全局时再通过 --skill-global 显式开启。
  return ["-y", "skills", "add", source, ...(global ? ["--global"] : []), "--yes"];
}

function createSkillRemoveArgs(global = false): string[] {
  return ["-y", "skills", "remove", "confluence-cli", "--yes", ...(global ? ["--global"] : [])];
}

function readOptionValue(arg: string, optionName: string): string | undefined {
  const prefix = `${optionName}=`;
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
}

function readRequiredOptionValue(args: string[], index: number, optionName: string): string {
  const arg = args[index];
  const inlineValue = readOptionValue(arg, optionName);
  if (inlineValue !== undefined) {
    if (inlineValue.trim() === "") {
      throw createMissingOptionValueError(optionName);
    }
    return inlineValue;
  }

  const next = args[index + 1];
  if (typeof next !== "string" || next.startsWith("--")) {
    throw createMissingOptionValueError(optionName);
  }

  return next;
}

function createMissingOptionValueError(optionName: string): Error {
  if (optionName === "--skill-local-path") {
    return new Error("--skill-local-path 需要传入本地目录路径");
  }

  return new Error(`${optionName} 需要传入参数值`);
}

function readBooleanFlag(args: string[], index: number, optionName: string): { value: boolean; consumedArgs: number } {
  const inlineValue = readOptionValue(args[index], optionName);
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
    await cleanupGlobalPackageResidues();
    await installGlobalCli(action);
    await installMermaidRenderer(action);
  }
  if (!options.cliOnly) {
    await installSkill(action, options);
  }
  await writeUpdateCacheAfterInstall();
}

async function installGlobalCli(action: "安装" | "更新"): Promise<void> {
  const args = ["install", "-g", `${PACKAGE_NAME}@latest`];
  try {
    await runStep(`${action} Confluence CLI`, "npm", args);
  } catch (error) {
    if (!isNpmDirectoryNotEmptyError(error)) {
      throw error;
    }
    process.stdout.write("\n检测到 npm 全局安装目录残留，正在清理后重试...\n");
    await cleanupGlobalPackageResidues();
    await runStep(`${action} Confluence CLI`, "npm", args);
  }
}

async function installMermaidRenderer(action: "安装" | "更新"): Promise<void> {
  try {
    await runStep(`${action} Mermaid 免浏览器渲染器 beautiful-mermaid-cli`, "npm", ["install", "-g", `${MERMAID_RENDERER_PACKAGE}@latest`]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`已跳过 beautiful-mermaid-cli 安装：${message}\n`);
    process.stdout.write("后续如需 Mermaid 图片渲染，可稍后重试安装，或在上传时传 --mermaid none 保留代码块。\n");
  }
}

function isNpmDirectoryNotEmptyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ENOTEMPTY") || message.toLowerCase().includes("directory not empty");
}

async function runNpxStepWithRetry(title: string, args: string[]): Promise<void> {
  try {
    await runStep(title, "npx", args);
  } catch (error) {
    if (!isNpmDirectoryNotEmptyError(error)) {
      throw error;
    }
    process.stdout.write(`\n检测到 npx 缓存目录残留，正在清理后重试 ${title}...\n`);
    await cleanupNpxResidues();
    await runStep(title, "npx", args);
  }
}

async function installSkill(action: "安装" | "更新", options: InstallOptions): Promise<void> {
  if (options.skillLocalPath) {
    await runNpxStepWithRetry(`${action} Confluence skill`, createSkillAddArgs(path.resolve(options.skillLocalPath), options.skillGlobal));
    return;
  }

  if (options.skillSource === "local") {
    await installSkillFromInstalledPackage(action, options.skillGlobal);
    return;
  }

  if (options.skillSource === "git") {
    await runNpxStepWithRetry(`${action} Confluence skill`, createSkillAddArgs(GIT_SKILL_SOURCE, options.skillGlobal));
    return;
  }

  await installSkillFromNpmPackage(action, options.skillGlobal);
}

async function installSkillFromInstalledPackage(action: "安装" | "更新", skillGlobal: boolean): Promise<void> {
  const skillPath = await getInstalledPackageSkillPath();
  try {
    await access(skillPath);
  } catch {
    process.stdout.write(`未找到已安装包内的 Confluence skill：${skillPath}，正在自动回退到 npm 包解压安装...\n`);
    await installSkillFromNpmPackage(action, skillGlobal);
    return;
  }
  await runNpxStepWithRetry(`${action} Confluence skill`, createSkillAddArgs(skillPath, skillGlobal));
}

async function getInstalledPackageSkillPath(): Promise<string> {
  const globalNodeModules = (await runCommandOutput("npm", ["root", "-g"])).trim();
  if (!globalNodeModules) throw new Error("npm root -g 没有返回全局 node_modules 路径");
  return path.join(globalNodeModules, PACKAGE_NAME, "skills", "confluence-cli");
}

async function installSkillFromNpmPackage(action: "安装" | "更新", skillGlobal: boolean): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "confluence-cli-skill-"));
  try {
    const stdout = await runCommandOutput("npm", ["pack", `${PACKAGE_NAME}@latest`, "--pack-destination", tempDir, "--silent"]);
    const tarballName = stdout.trim().split("\n").filter(Boolean).at(-1);
    if (!tarballName) throw new Error("npm pack 没有返回包文件名");

    await runStep("解压 Confluence npm 包", "tar", ["-xzf", path.join(tempDir, tarballName), "-C", tempDir]);
    await runNpxStepWithRetry(`${action} Confluence skill`, createSkillAddArgs(path.join(tempDir, "package"), skillGlobal));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function uninstallSkill(): Promise<void> {
  await runNpxStepWithRetry("卸载项目级 Confluence skill", createSkillRemoveArgs(false));
  await runNpxStepWithRetry("卸载全局级 Confluence skill", createSkillRemoveArgs(true));
}

async function uninstallPackage(): Promise<void> {
  await runStep("卸载 Confluence CLI", "npm", ["uninstall", "-g", PACKAGE_NAME]);
  await cleanupGlobalPackageResidues();
  await uninstallMermaidRenderer();
}

async function uninstallMermaidRenderer(): Promise<void> {
  try {
    await runStep("卸载 Mermaid 免浏览器渲染器 beautiful-mermaid-cli", "npm", ["uninstall", "-g", MERMAID_RENDERER_PACKAGE]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(`已跳过 beautiful-mermaid-cli 卸载：${message}\n`);
  }
}

async function cleanupGlobalPackageResidues(): Promise<void> {
  const globalNodeModules = (await runCommandOutput("npm", ["root", "-g"])).trim();
  if (globalNodeModules) {
    await rm(path.join(globalNodeModules, PACKAGE_NAME), { recursive: true, force: true });
    const scopeDir = path.join(globalNodeModules, "@cloudglab");
    let entries: string[] = [];
    try {
      entries = await readdir(scopeDir);
    } catch {
      entries = [];
    }
    await Promise.all(entries
      .filter((entry) => entry.startsWith(".confluence-cli-"))
      .map((entry) => rm(path.join(scopeDir, entry), { recursive: true, force: true })));
  }

  await cleanupNpxResidues();
}

async function cleanupNpxResidues(): Promise<void> {
  const npxCacheDir = path.join(os.homedir(), ".npm", "_npx");
  let entries: string[] = [];
  try {
    entries = await readdir(npxCacheDir);
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const hashDir = path.join(npxCacheDir, entry);
    const cloudglabDir = path.join(hashDir, "node_modules", "@cloudglab");
    let cloudglabEntries: string[] = [];
    try {
      cloudglabEntries = await readdir(cloudglabDir);
    } catch {
      return;
    }

    const hasConfluenceCli = cloudglabEntries.some((item) => item === "confluence-cli" || item.startsWith(".confluence-cli-"));
    if (hasConfluenceCli) {
      await rm(hashDir, { recursive: true, force: true });
    }
  }));
}

async function removeConfigFile(): Promise<void> {
  await rm(path.join(os.homedir(), ".confluence", "config.json"), { force: true });
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
    const child = spawn(command, args, { shell: process.platform === "win32", env: createInstallEnv() });
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
    const child = spawn(command, args, { shell: process.platform === "win32", env: createInstallEnv() });
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

function createInstallEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: process.env.CI ?? "true",
  };
}

function renderBanner(): string {
  return [
    "   ___       ___       ___       ___       ___       ___       ___       ___       ___       ___   ",
    "  /\\  \\     /\\  \\     /\\__\\     /\\  \\     /\\__\\     /\\__\\     /\\  \\     /\\__\\     /\\  \\     /\\  \\  ",
    " /::\\  \\   /::\\  \\   /:| _|_   /::\\  \\   /:/  /    /:/ _/_   /::\\  \\   /:| _|_   /::\\  \\   /::\\  \\ ",
    "/:/\\:\\__\\ /:/\\:\\__\\ /::|/\\__\\ /::\\:\\__\\ /:/__/    /:/_/\\__\\ /::\\:\\__\\ /::|/\\__\\ /:/\\:\\__\\ /::\\:\\__\\",
    "\\:\\ \/__/ \\:\\/:/  / \\/|::/  / \\/\\:\\/__/ \\:\\  \\    \\:\\/:/  / \\:\\:\\/  / \\/|::/  / \\:\\ \/__/ \\:\\:\\/  /",
    " \\:\\__\\    \\::/  /    |:/  /     \/__/   \\:\\__\\    \\::/  /   \\:\\/  /    |:/  /   \\:\\__\\    \\:\\/  / ",
    "  \/__/     \/__/     \/__/               \/__/     \/__/     \/__/     \/__/     \/__/     \/__/ ",
  ].join("\n");
}
