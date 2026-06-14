import { z } from "zod";
import type { CliRegistry } from "../core/cli-registry.js";
import { runInstallCommand, runUpdateCommand } from "../install.js";
import { jsonResult } from "../utils/result.js";

const installSchema = z.object({
  "skill-source": z.enum(["local", "git", "npm"]).optional().default("local").describe("技能来源"),
  "skill-local-path": z.string().optional().describe("本地 skill 目录"),
  "skip-config-check": z.boolean().optional().default(false).describe("跳过配置校验"),
  "cli-only": z.boolean().optional().default(false).describe("只安装 CLI"),
  "skill-only": z.boolean().optional().default(false).describe("只安装 skill"),
});

export function registerInstallTools(registry: CliRegistry): void {
  registry.tool("install", installSchema, async (input) => {
    const args = toInstallArgs(input);
    await runInstallCommand(args);
    return jsonResult({ ok: true, command: "install", args });
  }, "Install CLI and skill");

  registry.tool("update", installSchema, async (input) => {
    const args = toInstallArgs(input);
    await runUpdateCommand(args);
    return jsonResult({ ok: true, command: "update", args });
  }, "Update CLI and skill");
}

function toInstallArgs(input: Record<string, unknown>): string[] {
  const args: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "undefined") continue;
    if (typeof value === "boolean") {
      args.push(`--${key}`, value ? "true" : "false");
      continue;
    }
    args.push(`--${key}`, String(value));
  }
  return args;
}
