#!/usr/bin/env node
// scripts/check-coverage.mjs
// Zero-dependency coverage checker: reference/*.md 文档覆盖 vs CLI 注册命令。
// 对齐 zentao-cli scripts/coverage.mjs 的设计,但只校验 reference → CLI 这一条链路。
//
// 用法:
//   node scripts/check-coverage.mjs                # human-readable
//   node scripts/check-coverage.mjs --json        # JSON 输出
//   node scripts/check-coverage.mjs --missing      # 仅打印未覆盖的命令
//
// 退出码:全部覆盖返回 0,否则返回 1。

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

// ---------- CLI args ----------
const argv = process.argv.slice(2);
const wantJson = argv.includes("--json");
const wantMissing = argv.includes("--missing");

// ---------- 内置 / 别名白名单 ----------
// 这两类不算"CLI 注册命令",但 reference 文档经常会提到,避免 false-positive unknown 噪声。
const BUILTIN_AND_ALIASES = new Set([
  // 内置命令
  "help",
  "list",
  "version",
  "changelog",
  // 别名
  "upgrade", // update 的别名
  // 角色 / bin 别名
  "confluence",
  "confluence-reader",
  "confluence-writer",
]);

// ---------- 提取 src/tools/*.ts 注册的命令 ----------
function extractCliCommands(repo) {
  const toolsDir = join(repo, "src", "tools");
  if (!existsSync(toolsDir)) return new Set();

  const files = readdirSync(toolsDir).filter((file) => file.endsWith(".ts"));
  const names = new Set();

  for (const file of files) {
    const text = readFileSync(join(toolsDir, file), "utf8");
    // 匹配 registry.tool('name' / "name" / `name`)
    const re = /registry\.tool\(\s*['"`]([a-zA-Z][a-zA-Z0-9-]*)['"`]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      names.add(match[1]);
    }
  }

  return names;
}

// ---------- 从 reference/*.md 提取提到的命令名 ----------
function extractReferenceCommands(repo) {
  const refDir = join(repo, ".agents", "skills", "confluence-cli", "reference");
  if (!existsSync(refDir)) return new Set();

  const files = readdirSync(refDir).filter((file) => file.endsWith(".md"));
  const names = new Set();

  for (const file of files) {
    const text = readFileSync(join(refDir, file), "utf8");
    // 1) 反引号包裹的命令名
    const re = /`([a-zA-Z][a-zA-Z0-9-]*)`/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      names.add(match[1]);
    }
    // 2) confluence <cmd> 形式
    const cliRe = /\bconfluence\s+([a-zA-Z][a-zA-Z0-9-]*)/g;
    while ((match = cliRe.exec(text)) !== null) {
      names.add(match[1]);
    }
  }

  return names;
}

function main() {
  const cliSet = extractCliCommands(REPO);
  const refSet = extractReferenceCommands(REPO);

  const missing = [...cliSet].filter((name) => !refSet.has(name)).sort();
  const unknown = [...refSet]
    .filter((name) => !cliSet.has(name) && !BUILTIN_AND_ALIASES.has(name))
    .sort();

  const covered = cliSet.size - missing.length;
  const ratio = cliSet.size === 0 ? 0 : covered / cliSet.size;

  const payload = {
    cliCommandCount: cliSet.size,
    covered,
    missingCount: missing.length,
    unknownCount: unknown.length,
    ratio,
    missing,
    unknown,
    cliCommands: [...cliSet].sort(),
    referenceCommands: [...refSet].sort(),
    generatedAt: new Date().toISOString(),
  };

  if (wantJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    if (missing.length > 0) process.exitCode = 1;
    return;
  }

  if (wantMissing) {
    if (missing.length === 0) {
      process.stdout.write("全部 CLI 命令都已被 reference 覆盖。\n");
    } else {
      process.stdout.write(`未覆盖的命令 (${missing.length}/${cliSet.size}):\n`);
      for (const name of missing) process.stdout.write(`  - ${name}\n`);
    }
    if (missing.length > 0) process.exitCode = 1;
    return;
  }

  // 默认:human-readable 报告
  const lines = [];
  lines.push("=== confluence-cli reference 覆盖 vs CLI 注册命令 ===");
  lines.push(`CLI 命令总数: ${cliSet.size}`);
  lines.push(`reference 文档覆盖: ${covered} / ${cliSet.size} (${(ratio * 100).toFixed(1)}%)`);
  lines.push(`未覆盖命令数: ${missing.length}`);
  lines.push(`误识别(reference 中但 CLI 没注册): ${unknown.length}`);
  lines.push("");
  if (missing.length > 0) {
    lines.push("未覆盖命令:");
    for (const name of missing) lines.push(`  - ${name}`);
    lines.push("");
  }
  if (unknown.length > 0) {
    lines.push("误识别(reference 中提到但 CLI 未注册):");
    for (const name of unknown) lines.push(`  - ${name}`);
    lines.push("");
  }
  lines.push("=== 验证建议 ===");
  lines.push("  pnpm coverage             # 跑本脚本");
  lines.push("  pnpm coverage --missing   # 只看未覆盖");
  lines.push("  pnpm coverage --json      # CI 用 JSON 输出");
  process.stdout.write(`${lines.join("\n")}\n`);

  if (missing.length > 0) process.exitCode = 1;
}

main();