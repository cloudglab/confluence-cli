#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".git")) {
  console.log("Skip lefthook install: not a git repository.");
  process.exit(0);
}

const result = spawnSync("lefthook", ["install"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
