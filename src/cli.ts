import { parseCommandInput } from "./core/cli-registry.js";
import {
  BUILTIN_COMMAND_NAMES,
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
  const result = await selected.handler(input);
  process.stdout.write(`${result.content[0]?.text ?? ""}\n`);
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

  return { command: args[0], commandArgs: args.slice(1), role };
}
