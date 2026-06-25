import { parseCommandInput } from "./core/cli-registry.js";
import { looksLikeUrl } from "./core/url-parser.js";
import {
  BUILTIN_COMMAND_NAMES,
  formatCommandOutput,
  getBuiltinCommandHelp,
  printCommandHelp,
  printCommandList,
  printHelp,
  renderChangelog,
  type ChangelogOptions,
} from "./core/cli-output.js";
import { buildRegistryForCommand, getAvailableCommandNames } from "./core/manifest.js";
import { runInstallCommand, runUninstallCommand, runUpdateCommand } from "./install.js";
import { runDailyUpdateProbe } from "./update-probe.js";
import { appendCommandMeta } from "./utils/output-mode.js";
import { isValidOutputMode, setGlobalOutputMode } from "./utils/result.js";
import { resetMetrics, snapshotMetrics } from "./core/http-metrics.js";
import { VERSION } from "./version.js";
import type { Role } from "./types/common.js";

export async function runCli(argv: string[]): Promise<void> {
  const { command, commandArgs, role } = parseCli(argv);
  const registeredCommandNames = await getAvailableCommandNames(role);
  const commandNames = [...new Set([...BUILTIN_COMMAND_NAMES, ...registeredCommandNames])]
    .sort((left, right) => left.localeCompare(right));

  await runDailyUpdateProbe(command);

  if (command === "help" && commandArgs[0] && !commandArgs[0].startsWith("--")) {
    const builtinHelp = getBuiltinCommandHelp(commandArgs[0]);
    if (builtinHelp) {
      process.stdout.write(`${builtinHelp}\n`);
      return;
    }
    const targetRegistry = await buildRegistryForCommand(role, commandArgs[0]);
    printCommandHelp(targetRegistry, commandArgs[0]);
    return;
  }

  const helpIndex = commandArgs.indexOf("--help");
  if (command && helpIndex >= 0) {
    const builtinHelp = getBuiltinCommandHelp(command);
    if (builtinHelp) {
      process.stdout.write(`${builtinHelp}\n`);
      return;
    }
    const targetRegistry = await buildRegistryForCommand(role, command);
    printCommandHelp(targetRegistry, command);
    return;
  }

  if (!command || command === "help") {
    printHelp(role, registeredCommandNames);
    return;
  }

  if (command === "list") {
    const listOptions = parseListOptions(commandArgs);
    if (listOptions.raw) {
      process.stdout.write(`${commandNames.join("\n")}\n`);
      return;
    }
    printCommandList(role, registeredCommandNames);
    return;
  }

  if (command === "version") {
    ensureNoUnexpectedArgs("version", commandArgs);
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (command === "changelog") {
    const options = parseChangelogOptions(commandArgs);
    process.stdout.write(`${await renderChangelog(options)}\n`);
    return;
  }

  if (command === "install") {
    await runInstallCommand(commandArgs);
    return;
  }

  if (command === "update" || command === "upgrade") {
    await runUpdateCommand(commandArgs);
    return;
  }

  if (command === "uninstall" || command === "remove") {
    await runUninstallCommand(commandArgs);
    return;
  }

  const commandRegistry = await buildRegistryForCommand(role, command);
  const selected = commandRegistry.get(command);
  if (!selected) {
    throw new Error(`Unknown command: ${command}`);
  }

  const input = parseCommandInput(selected.schema, commandArgs);
  resetMetrics();
  const rawResult = await selected.handler(input);
  const result = appendCommandMeta(rawResult, { ...snapshotMetrics() });
  const rawText = result.content[0]?.text ?? "";
  // whoami / who-am-i / getCurrentUser 走专用渲染,其他命令保持 JSON 输出
  const finalText = await formatCommandOutput(command, rawText);
  process.stdout.write(`${finalText}\n`);
}

function parseListOptions(args: string[]): { raw: boolean } {
  const unexpectedArgs = args.filter((arg) => arg !== "--raw");
  if (unexpectedArgs.length > 0) {
    throw new Error(`list 不支持额外参数: ${unexpectedArgs.join(" ")}`);
  }

  return { raw: args.includes("--raw") };
}

function ensureNoUnexpectedArgs(commandName: string, args: string[]): void {
  if (args.length > 0) {
    throw new Error(`${commandName} 不支持额外参数: ${args.join(" ")}`);
  }
}

function parseChangelogOptions(args: string[]): ChangelogOptions {
  const options: ChangelogOptions = { limit: 5, raw: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--raw") {
      options.raw = true;
      continue;
    }

    if (arg === "--limit" || arg.startsWith("--limit=")) {
      const value = arg.startsWith("--limit=") ? arg.slice("--limit=".length) : args[++index];
      if (value === undefined) throw new Error("changelog --limit 需要一个值");
      if (value === "all") {
        options.limit = "all";
        continue;
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`changelog --limit 必须是正整数或 all，收到: ${value}`);
      }
      options.limit = parsed;
      continue;
    }

    if (arg === "--version" || arg.startsWith("--version=")) {
      const value = arg.startsWith("--version=") ? arg.slice("--version=".length) : args[++index];
      if (!value) throw new Error("changelog --version 需要一个值");
      options.version = value;
      continue;
    }

    if (arg === "--since" || arg.startsWith("--since=")) {
      const value = arg.startsWith("--since=") ? arg.slice("--since=".length) : args[++index];
      if (!value) throw new Error("changelog --since 需要一个值");
      options.since = value;
      continue;
    }

    throw new Error(`changelog 不支持参数: ${arg}`);
  }

  return options;
}

function parseCli(argv: string[]): { command?: string; commandArgs: string[]; role: Role } {
  const args = [...argv];
  let role: Role = "full";

  // --output compact|normal|verbose: 必须在 runCli 早期应用,以便影响所有 handler
  const inlineOutputIndex = args.findIndex((arg) => arg.startsWith("--output="));
  if (inlineOutputIndex >= 0) {
    const value = args[inlineOutputIndex].slice("--output=".length);
    if (!isValidOutputMode(value)) {
      throw new Error(`无效 output mode: ${value}（需要 compact|normal|verbose）`);
    }
    setGlobalOutputMode(value);
    args.splice(inlineOutputIndex, 1);
  }

  const outputIndex = args.indexOf("--output");
  if (outputIndex >= 0) {
    const value = args[outputIndex + 1];
    if (!value) throw new Error("--output 需要一个值");
    if (!isValidOutputMode(value)) {
      throw new Error(`无效 output mode: ${value}（需要 compact|normal|verbose）`);
    }
    setGlobalOutputMode(value);
    args.splice(outputIndex, 2);
  }

  const inlineRoleIndex = args.findIndex((arg) => arg.startsWith("--role=") || arg.startsWith("-r="));
  if (inlineRoleIndex >= 0) {
    const value = args[inlineRoleIndex].split("=", 2)[1];
    if (value !== "full" && value !== "reader" && value !== "writer") {
      throw new Error(`无效 role: ${value}`);
    }
    role = value;
    args.splice(inlineRoleIndex, 1);
  }

  const roleIndex = args.indexOf("--role");
  if (roleIndex >= 0) {
    const value = args[roleIndex + 1];
    if (value !== "full" && value !== "reader" && value !== "writer") {
      throw new Error("--role must be full, reader, or writer");
    }
    role = value;
    args.splice(roleIndex, 2);
  }

  const normalized = normalizeCommandAlias(args[0], args.slice(1));

  // 隐式 URL 入口:首参是 URL 时,自动走 urlParse
  if (normalized.command && looksLikeUrl(normalized.command)) {
    const url = normalized.command;
    const remaining = args.slice(1 + normalized.consumedArgs);
    return {
      command: "urlParse",
      commandArgs: ["--url", url, ...remaining],
      role,
    };
  }

  return {
    command: normalized.command,
    commandArgs: args.slice(1 + normalized.consumedArgs),
    role,
  };
}

function normalizeCommandAlias(command: string | undefined, args: string[]): { command: string | undefined; consumedArgs: number } {
  if (command === "--version" || command === "-v") {
    return { command: "version", consumedArgs: 0 };
  }

  if (command === "who" && args[0] === "am" && args[1] === "i") {
    return { command: "whoami", consumedArgs: 2 };
  }

  return { command, consumedArgs: 0 };
}
