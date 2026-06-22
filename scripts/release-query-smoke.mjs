#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(rootDir, "dist/bin/confluence.js");
const dryRun = process.argv.includes("--dry-run");
const continueOnError = process.argv.includes("--continue-on-error");

const value = (name, fallback = undefined) => process.env[`CONFLUENCE_SMOKE_${name}`] || fallback;

const vars = {
  cql: value("CQL", 'type = "page"'),
  contentId: value("CONTENT_ID", "5278156"),
  space: value("SPACE", "GABI"),
  title: value("TITLE"),
};

const commandSurface = [
  "addComment",
  "addLabels",
  "callRestApi",
  "changelog",
  "convertContentBody",
  "convertMarkdownToWiki",
  "convertMermaidToDrawio",
  "deleteContent",
  "deleteLabel",
  "downloadAttachment",
  "downloadPage",
  "findContent",
  "generateMarkMetadata",
  "getComments",
  "getContent",
  "getCurrentUser",
  "getLabels",
  "getPageChildren",
  "getSpace",
  "help",
  "initConfluence",
  "install",
  "list",
  "listAttachments",
  "listRestApis",
  "listSpaces",
  "searchContent",
  "update",
  "uploadAttachment",
  "uploadHtml",
  "uploadMarkdown",
  "updateAttachment",
  "version",
];

const schemaChecks = commandSurface.map((name) => cmdAs(`help:${name}`, "help", name));
const liveQueries = [
  cmd("list"),
  cmd("version"),
  cmd("changelog", "--limit", "1"),
  cmd("listRestApis", "--limit", "5"),
  cmd("getCurrentUser"),
  cmd("listSpaces", "--limit", "5"),
  cmd("searchContent", "--cql", vars.cql, "--limit", "5"),
  cmdIf("getSpace", ["space"], "--spaceKey", vars.space),
  cmdIf("getContent", ["contentId"], "--id", vars.contentId, "--expand", "version"),
  cmdIf("getPageChildren", ["contentId"], "--id", vars.contentId, "--limit", "5"),
  cmdIf("getLabels", ["contentId"], "--id", vars.contentId),
  cmdIf("listAttachments", ["contentId"], "--id", vars.contentId),
  cmdIf("findContent", ["space"], "--space", vars.space, "--limit", "5", ...optionalArgs("--title", vars.title)),
];

const commands = [...schemaChecks, ...liveQueries];

if (!dryRun && !existsSync(cliPath)) {
  console.error("缺少 dist/bin/confluence.js，请先运行 pnpm build。");
  process.exit(1);
}

let passed = 0;
let skipped = 0;
let failed = 0;

for (const item of commands) {
  if (item.skip) {
    skipped += 1;
    console.log(`SKIP ${item.label}: 缺少 ${item.missing.map((name) => `CONFLUENCE_SMOKE_${toEnvName(name)}`).join(", ")}`);
    continue;
  }

  const printable = ["confluence", ...item.args].join(" ");
  if (dryRun) {
    passed += 1;
    console.log(`DRY  ${printable}`);
    continue;
  }

  console.log(`RUN  ${printable}`);
  const result = spawnSync(process.execPath, [cliPath, ...item.args], {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status === 0) {
    passed += 1;
    console.log(`OK   ${item.label}`);
    continue;
  }

  failed += 1;
  console.error(`FAIL ${item.label}`);
  if (result.stdout) console.error(result.stdout.trim());
  if (result.stderr) console.error(result.stderr.trim());
  if (!continueOnError) break;
}

console.log(`\nSummary: passed=${passed}, skipped=${skipped}, failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);

function cmd(label, ...args) {
  return { label, args: args.length > 0 ? [label, ...args] : [label] };
}

function cmdAs(label, ...args) {
  return { label, args };
}

function cmdIf(label, required, ...args) {
  const missing = required.filter((name) => !vars[name]);
  const commandName = args[0] && !String(args[0]).startsWith("--") ? String(args[0]) : label;
  return { label, args: [commandName, ...args.slice(commandName === label ? 0 : 1)], skip: missing.length > 0, missing };
}

function optionalArgs(flag, value) {
  return value ? [flag, value] : [];
}

function toEnvName(name) {
  return name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
}
