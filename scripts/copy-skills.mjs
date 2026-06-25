import { cp, rm } from "node:fs/promises";
import path from "node:path";

// 编辑源:.agents/skills/confluence-cli/
// 构建产物:skills/confluence-cli/(随 npm 包一起分发)
const source = path.resolve(".agents/skills/confluence-cli");
const target = path.resolve("skills/confluence-cli");

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
process.stdout.write(`Copied skill from ${source} to ${target}\n`);