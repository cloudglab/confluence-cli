import { z } from "zod";
import { VERSION } from "../version.js";
import type { Role } from "../types/common.js";
import { loadChangelogRaw, loadChangelogSections } from "./changelog.js";
import type { InMemoryCliRegistry } from "./cli-registry.js";

const BUILTIN_DESCRIPTIONS: Record<string, string> = {
  help: "查看总帮助或指定命令参数",
  list: "按场景列出可用命令",
  version: "查看 CLI 版本",
  changelog: "查看版本更新记录",
  install: "安装 CLI 和 Confluence skill",
  update: "更新 CLI 和 Confluence skill",
  upgrade: "update 的别名",
  uninstall: "卸载 CLI / skill / 配置",
  remove: "uninstall 的别名",
};

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  initConfluence: "初始化或校验 Confluence 连接配置",
  install: "安装 CLI 和 Confluence skill",
  update: "更新 CLI 和 Confluence skill",
  convertMarkdownToWiki: "将 Markdown 转换为 Confluence Wiki 标记",
  convertMermaidToDrawio: "将 Mermaid 图转换为 draw.io XML",
  generateMarkMetadata: "生成 Markdown 页面元数据",
  request: "发送原始 Confluence REST 请求",
  searchSpace: "搜索 Confluence 空间",
  listSpaces: "列出 Confluence 空间",
  getSpace: "获取空间详情",
  getCurrentUser: "输出当前账号原始资料",
  whoami: "查看当前 Confluence 账号",
  "who-am-i": "whoami 的别名",
  searchContent: "使用 CQL 搜索内容",
  getContent: "获取页面或博客内容",
  getPageSnapshot: "单次拿到页面快照(focus + body 预览 + labels + comments + attachments + 子页)",
  createContent: "创建 Confluence 内容",
  updateContent: "更新 Confluence 内容",
  deleteContent: "删除 Confluence 内容",
  addLabels: "添加内容标签",
  removeLabel: "移除内容标签",
  listLabels: "列出内容标签",
  listAttachments: "列出页面附件",
  uploadAttachment: "上传页面附件",
  downloadAttachment: "下载页面附件",
  uploadMarkdown: "上传 Markdown 为 Confluence storage 页面",
  downloadPage: "下载页面为本地内容",
};

export const BUILTIN_COMMAND_NAMES = ["changelog", "help", "list", "version"];
export const BUILTIN_COMMAND_ALIASES = ["install", "update", "upgrade", "uninstall", "remove"];

export function printHelp(role: Role, commandNames: string[]): void {
  const recommended = getRecommendedCommands(commandNames);
  process.stdout.write([
    `confluence CLI ${VERSION}`,
    "",
    `当前 role: ${role}`,
    "适配版本：Confluence Data Center / Server REST API。",
    "运行要求：Node.js >= 20",
    "",
    "用法：",
    "  confluence [--role full|reader|writer] <command> [--key value]",
    "  confluence help <command>",
    "  confluence <command> --help",
    "",
    "快速开始：",
    "  confluence list                 查看全部可用命令（推荐）",
    "  confluence help <command>       查看命令参数",
    "  confluence whoami               校验当前账号",
    "  confluence initConfluence       初始化或校验连接配置",
    "  confluence version              查看版本",
    "  confluence changelog            查看最近更新",
    "",
    "安装/更新：",
    "  confluence install              一键安装 CLI + Skill",
    "  confluence update               更新到最新版本",
    "  npx -y @cloudglab/confluence-cli@latest install",
    "",
    "常用命令：",
    ...recommended.map((item) => `  - ${item.name.padEnd(28)} ${item.description}`),
    "",
    "写操作保护：",
    "  真实写操作必须显式传 --confirm true",
    "  CONFLUENCE_DISABLE_WRITE=true 可强制禁用真实写入",
    "",
    "查看更多：",
    "  confluence list                 按场景查看命令说明",
    "  confluence list --raw           仅输出命令名，适合脚本处理",
    "  confluence help <command>       查看某个命令的参数",
    "",
  ].join("\n"));
}

export function printCommandList(role: Role, commandNames: string[], builtinCommandNames = BUILTIN_COMMAND_NAMES): void {
  const allCommandNames = [...new Set([...builtinCommandNames, ...commandNames])]
    .sort((left, right) => left.localeCompare(right));
  const groups = buildCommandGroups(allCommandNames);

  const lines = [
    "confluence 可用命令",
    "",
    `当前 role: ${role}`,
    `命令数量：${allCommandNames.length}`,
    "",
  ];

  for (const group of groups) {
    if (group.commands.length === 0) continue;
    lines.push(`${group.title}：`);
    for (const commandName of group.commands) {
      lines.push(`  - ${commandName.padEnd(28)} ${describeCommand(commandName)}`);
    }
    lines.push("");
  }

  lines.push(
    "下一步：",
    "  - 查看参数：confluence help <command>，例如 confluence help searchContent",
    "  - 快速校验账号：confluence whoami",
    "  - 初始化配置：confluence initConfluence",
    "  - 查看脚本友好命令名：confluence list --raw",
    "  - 切换角色命令集：confluence --role reader list 或 confluence --role writer list",
    "",
  );

  process.stdout.write(lines.join("\n"));
}

export function getBuiltinCommandHelp(commandName: string): string | undefined {
  const normalizedCommand = commandName === "upgrade"
    ? "update"
    : commandName === "remove"
      ? "uninstall"
      : commandName;

  const help: Record<string, string> = {
    help: [
      "confluence help [command]",
      "",
      "查看总帮助或指定命令参数。",
    ].join("\n"),
    list: [
      "confluence list [--raw]",
      "",
      "按场景列出可用命令。",
      "",
      "参数：",
      "  --raw  仅输出命令名，每行一个，适合脚本处理",
    ].join("\n"),
    install: [
      "confluence install",
      "",
      "用法：",
      "  confluence install [--skill-source local|git|npm] [--skill-local-path <path>] [--skill-global] [--skip-config-check] [--cli-only] [--skill-only]",
      "  npx -y @cloudglab/confluence-cli@latest install",
      "",
      "说明：",
      "  安装或更新 CLI，并按来源安装 Confluence skill。默认安装到 user-level 全局目录，并固定 --agent universal，避免 skills 自动探测到不支持全局安装的 agent（如 PromptScript）。",
      "",
      "参数：",
      "  --skill-source <local|git|npm> （可选）：skill 安装来源，默认 local。",
      "  --skill-local-path <string> （可选）：直接从本地目录安装 skill。",
      "  --skill-global （可选，默认 true）：将 skill 装到 user-level 全局目录；传 false 时改为项目级安装。",
      "  --skip-config-check （可选）：安装后跳过 Confluence 配置校验。",
      "  --cli-only （可选）：只安装 CLI，不安装 skill。",
      "  --skill-only （可选）：只安装 skill，不安装 CLI。",
    ].join("\n"),
    update: [
      "confluence update",
      "",
      "用法：",
      "  confluence update [--skill-source local|git|npm] [--skill-local-path <path>] [--skill-global] [--skip-config-check] [--cli-only] [--skill-only]",
      "  npx -y @cloudglab/confluence-cli@latest update",
      "",
      "说明：",
      "  更新或重新安装 CLI，并按来源更新 Confluence skill。默认全局安装，--skill-global 同 install。",
      "",
      "参数：",
      "  --skill-source <local|git|npm> （可选）：skill 更新来源，默认 local。",
      "  --skill-local-path <string> （可选）：直接从本地目录更新 skill。",
      "  --skill-global （可选，默认 true）：将 skill 装到 user-level 全局目录；传 false 时改为项目级安装。",
      "  --skip-config-check （可选）：更新后跳过 Confluence 配置校验。",
      "  --cli-only （可选）：只更新 CLI，不更新 skill。",
      "  --skill-only （可选）：只更新 skill，不更新 CLI。",
    ].join("\n"),
    uninstall: [
      "confluence uninstall",
      "",
      "用法：",
      "  confluence uninstall [--confirm true] [--keep-config true] [--cli-only] [--skill-only]",
      "  npx -y @cloudglab/confluence-cli@latest uninstall --confirm true",
      "",
      "说明：",
      "  卸载 CLI、Confluence skill，以及可选的本地配置文件。",
      "",
      "参数：",
      "  --confirm （可选）：显式确认后才真实执行卸载。",
      "  --keep-config （可选）：保留 ~/.confluence/config.json。",
      "  --cli-only （可选）：只卸载 CLI，不卸载 skill。",
      "  --skill-only （可选）：只卸载 skill，不卸载 CLI。",
    ].join("\n"),
    version: [
      "confluence version",
      "",
      "输出当前 CLI 版本。",
    ].join("\n"),
    changelog: [
      "confluence changelog [--limit N|all] [--version VERSION] [--since VERSION] [--raw]",
      "",
      "查看 CHANGELOG.md 中的版本更新记录。",
      "",
      "参数：",
      "  --limit N|all       输出最近 N 个版本，默认 5；all 输出全部",
      "  --version VERSION   只输出指定版本",
      "  --since VERSION     输出从最新版到指定版本的记录",
      "  --raw               输出完整 CHANGELOG.md 原文",
    ].join("\n"),
  };

  return help[normalizedCommand];
}

export function printCommandHelp(registry: InMemoryCliRegistry, name: string): void {
  process.stdout.write(`${renderCommandHelp(registry, name)}\n`);
}

export function renderCommandHelp(registry: InMemoryCliRegistry, name: string): string {
  const selected = registry.get(name);
  if (!selected) throw new Error(`Unknown command: ${name}`);
  const lines = [`confluence ${name} [--key value]`];
  if (selected.description) lines.push("", selected.description);
  const params = describeParams(selected.schema);
  if (params.length > 0) lines.push("", "Parameters:", ...params.map((param) => `  ${param}`));
  if (selected.metadata) {
    const meta = selected.metadata;
    const metaLines: string[] = [];
    if (meta.costHint) metaLines.push(`Approx cost: ${meta.costHint}`);
    if (meta.nextBestTools && meta.nextBestTools.length > 0) {
      metaLines.push(`Suggested next: ${meta.nextBestTools.map((next) => `confluence ${next}`).join(", ")}`);
    }
    if (meta.cacheable === false) metaLines.push("Cache: bypassed");
    if (meta.idempotent === false) metaLines.push("Idempotent: no (写操作,需要 --confirm true)");
    if (metaLines.length > 0) lines.push("", "Agent hints:", ...metaLines.map((line) => `  ${line}`));
  }
  return lines.join("\n");
}

interface CommandListGroup {
  title: string;
  match: (commandName: string) => boolean;
  commands: string[];
}

function buildCommandGroups(commandNames: string[]): CommandListGroup[] {
  const groups: CommandListGroup[] = [
    { title: "开始使用", match: (name) => ["changelog", "help", "list", "version", "install", "update", "upgrade", "uninstall", "remove", "initConfluence", "whoami", "who-am-i", "getCurrentUser"].includes(name), commands: [] },
    { title: "内容检索 / 页面", match: (name) => /Content|Page|searchContent|getContent/.test(name), commands: [] },
    { title: "上传 / 下载 / 附件", match: (name) => /Upload|Download|Attachment|upload|download/.test(name), commands: [] },
    { title: "空间 / 标签", match: (name) => /Space|Label/.test(name), commands: [] },
    { title: "转换 / 元数据", match: (name) => /convert|generate|Metadata|Markdown|Mermaid|Drawio/.test(name), commands: [] },
    { title: "底层 REST", match: (name) => ["request"].includes(name), commands: [] },
    { title: "其他", match: () => true, commands: [] },
  ];

  for (const commandName of commandNames) {
    const group = groups.find((item) => item.match(commandName));
    group?.commands.push(commandName);
  }

  return groups;
}

function getRecommendedCommands(commandNames: string[]): Array<{ name: string; description: string }> {
  const candidates = [
    { name: "whoami", description: "校验当前账号" },
    { name: "initConfluence", description: "初始化或校验连接配置" },
    { name: "searchContent", description: "使用 CQL 搜索页面/博客" },
    { name: "getContent", description: "读取 Confluence 内容" },
    { name: "uploadMarkdown", description: "上传 Markdown 页面（需确认）" },
    { name: "downloadPage", description: "下载页面到本地" },
    { name: "convertMarkdownToWiki", description: "本地转换 Markdown" },
  ];

  return candidates.filter((item) => commandNames.includes(item.name));
}

function describeCommand(commandName: string): string {
  return BUILTIN_DESCRIPTIONS[commandName]
    ?? COMMAND_DESCRIPTIONS[commandName]
    ?? `查看参数：confluence help ${commandName}`;
}

export interface ChangelogOptions {
  limit: number | "all";
  version?: string;
  since?: string;
  raw: boolean;
}

export async function renderChangelog(options: ChangelogOptions): Promise<string> {
  if (options.raw) return loadChangelogRaw();

  const sections = await loadChangelogSections();
  if (sections.length === 0) throw new Error("CHANGELOG.md 中没有版本记录");

  let selected = sections;
  if (options.version) {
    selected = sections.filter((section) => section.version === options.version);
    if (selected.length === 0) throw new Error(`未找到版本 ${options.version} 的更新记录`);
  } else if (options.since) {
    const sinceIndex = sections.findIndex((section) => section.version === options.since);
    if (sinceIndex === -1) throw new Error(`未找到起始版本 ${options.since}`);
    selected = sections.slice(0, sinceIndex + 1);
  } else if (options.limit !== "all") {
    selected = sections.slice(0, options.limit);
  }

  const header = options.version
    ? `confluence CLI ${options.version} 更新内容`
    : `confluence CLI 最近更新（共 ${sections.length} 个版本）`;

  return [header, "", ...selected.map((section) => section.content)].join("\n").trimEnd() + "\n";
}

function describeParams(schema: z.ZodType): string[] {
  const unwrapped = unwrapSchema(schema);
  if (!(unwrapped instanceof z.ZodObject)) return [];
  return Object.entries(unwrapped.shape).map(([key, field]) => describeParam(key, field as z.ZodType));
}

function describeParam(name: string, schema: z.ZodType): string {
  const isOptional = schema instanceof z.ZodOptional || schema instanceof z.ZodDefault;
  const defaultValue = schema instanceof z.ZodDefault ? formatDefaultValue((schema._def as { defaultValue: () => unknown }).defaultValue()) : undefined;
  const description = (schema as { description?: string }).description;
  const parts = [`--${name} ${describeZodType(schema)}`, isOptional ? "optional" : "required"];

  if (defaultValue !== undefined) parts.push(`default=${defaultValue}`);
  if (description) parts.push(description);
  return parts.join(" | ");
}

function unwrapSchema(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return unwrapSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return unwrapSchema((schema._def as { innerType: z.ZodType }).innerType);
  if (schema instanceof z.ZodEffects) return unwrapSchema(schema.innerType());
  return schema;
}

function describeZodType(schema: z.ZodType): string {
  const unwrapped = unwrapSchema(schema);
  if (unwrapped instanceof z.ZodString) return "string";
  if (unwrapped instanceof z.ZodNumber) return "number";
  if (unwrapped instanceof z.ZodBoolean) return "boolean";
  if (unwrapped instanceof z.ZodArray) return "array";
  if (unwrapped instanceof z.ZodEnum) return unwrapped.options.join("|");
  if (unwrapped instanceof z.ZodObject) return "json-object";
  return "value";
}

function formatDefaultValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) return JSON.stringify(value);
  return String(value);
}
