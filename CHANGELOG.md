# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 0.0.6 - 2026-06-17

### 变更

- Mermaid 图片渲染从 `mmd-cli` 切换为 `beautiful-mermaid-cli` 的 `bm render`，默认 PNG/SVG 渲染不再依赖本机 Chrome、Chromium、Puppeteer 或原生编译工具链。
- `install` / `update` 改为通过 `npm install -g beautiful-mermaid-cli@latest` 安装 Mermaid 渲染器，不再执行 `raw.githubusercontent.com` 上的 `curl | sh` 安装脚本。
- 项目运行要求从 Node.js 18+ 提升到 Node.js 20+，与 `beautiful-mermaid-cli` 的运行时要求保持一致。
- 对齐 `zentao-cli` 的通用账号命令，新增 `whoami`、`who-am-i`，并支持 `confluence who am i` 口语化输入，均复用 `getCurrentUser` 查询当前 Confluence 账号。

### 测试

- `tests/install.test.ts` 同步断言新的 `beautiful-mermaid-cli` 安装链路，并保留安装失败不阻断主流程的回归覆盖。
- `tests/tools/transfer.test.ts` 同步校验 `bm render <file> -o <png> --json --scale 3` 调用参数。
- `tests/cli.test.ts` 和 `tests/tools/spaces.test.ts` 覆盖 `whoami` / `who-am-i` 注册、命令列表展示和 `who am i` 归一化。

## 0.0.5 - 2026-06-17

### 修复

- `install` / `update` 链路：把仓库内 `skills/confluence-cli` 从指向 `.agents/skills/confluence-cli` 的符号链接替换为真实目录副本，避免 npm tarball 中 `skills/confluence-cli` 路径在用户机器上不可用导致“未找到已安装包内的 Confluence skill”错误。
- `install` / `update` 链路：`installMmdCli` 不再因 `curl -fsSL ... | sh` 网络失败而中断整个安装，改为捕获异常并输出 `已跳过 mmd-cli 安装：<原因>` 与后续 `--mermaid none` 退路提示。
- `install` / `update` 链路：`installSkillFromInstalledPackage` 在 `access` 失败时不再直接抛错，自动回退到 `installSkillFromNpmPackage`（`npm pack` + `tar -xzf` + `npx -y skills add`），覆盖包内 skill 缺失场景。

### 测试

- `tests/install.test.ts` 新增回归用例 `本地 skill 缺失时自动回退到 npm 包解压安装，mmd-cli 失败不阻断安装`：mock `curl` 退出码 35、stderr 含 `curl: (35) LibreSSL SSL_connect...`，断言安装链路按 `npm install -g` → 跳过 `mmd-cli` → `npm pack` → `tar` → `npx -y skills add` 顺序完成，并校验 stdout 中包含“已跳过 mmd-cli 安装”与“正在自动回退到 npm 包解压安装”两行提示。

### 说明

- 本次热修不改变 `mmd-cli` 运行时仍需系统 Chrome/Chromium 的前提；网络环境下无法自动安装 `mmd-cli` 时，建议用户改用 `--mermaid none` 保留代码块。
- 验证结果：`pnpm test -- tests/install.test.ts tests/skill.test.ts tests/tools/transfer.test.ts` 全部通过（3 个文件、10 个测试）。

## 0.0.4 - 2026-06-17

### 修复

- Mermaid 渲染器从 `@mermaid-js/mermaid-cli` 全量替换为 `coolamit/mermaid-cli` 的原生二进制 `mmd-cli`，不再保留 `mmdc` / Puppeteer 兼容路径。
- `install` / `update` 链路会自动执行上游 `mmd-cli` 安装脚本，避免 npm 安装阶段拉取 Chrome 失败。
- `uninstall` 链路会一并清理 `~/.local/bin/mmd-cli` 和 `/usr/local/bin/mmd-cli`。
- `uploadMarkdown` 的 Mermaid 附件匹配逻辑改为优先按预期文件名命中，减少多附件场景下图片宏指向错误的问题。

### 测试

- `tests/install.test.ts` 新增 `mmd-cli` 安装步骤断言，覆盖 install / update 流程。
- `tests/tools/transfer.test.ts` 新增 Mermaid 渲染调用测试，校验 `mmd-cli` 的输入、输出、背景和缩放参数。

### 说明

- `mmd-cli` 运行时仍要求系统已有 Chrome/Chromium；如果目标机器没有浏览器，可在上传时传 `--mermaid none`，保留 Mermaid 代码块。

## 0.0.3 - 2026-06-16

### Fixed

- 撤掉 0.0.2 在 `npx -y skills add` 命令里默认追加的 `--global`。`vercel-labs/skills` 在 agent 内运行时本身就走项目级（`cwd` 下对应 agent 的 skills 目录），与 npx 临时目录是否被回收无关；强制传 `--global` 会让不支持全局安装的 agent（如 `PromptScript`，见 `vercel-labs/skills` `src/installer.ts`）直接报 `does not support global skill installation`。
- 新增 `--skill-global` opt-in 标记，用户明确需要 user-level 全局时通过 `confluence install --skill-global true` / `confluence update --skill-global true` 显式开启。`InstallOptions` 新增 `skillGlobal: boolean`（默认 `false`），CLI 工具层 schema 与 help 文本同步更新。
- `runUninstallCommand` 链路行为不变（仍同时清理项目级与全局级残留），0.0.2 升级到 0.0.3 不会丢清理路径。

### Tests

- `tests/install.test.ts` 回退 3 处 `npx -y skills add` 期望参数为 `--yes`（默认项目级），新增 `--skill-global true` 用例验证 opt-in 路径会追加 `--global`。
- `tests/cli.test.ts` / `tests/update-probe.test.ts` 硬编码版本号同步 0.0.2 → 0.0.3。

## 0.0.2 - 2026-06-16（已撤回）

> 0.0.2 在 `createSkillAddArgs` 里默认传 `--global`，对不支持全局的 agent 不可用，发布后已被 0.0.3 撤回。已通过 `npm deprecate` 标记，请直接升级到 0.0.3。

### Reverted by 0.0.3

- 撤掉 `createSkillAddArgs` 默认追加的 `--global`；改回 `--yes`（项目级）。
- `runUninstallCommand` 链路保持兼容。

## 0.0.1 - 2026-06-15

### Added

- 初始 Confluence REST CLI，覆盖配置发现、CQL 搜索、页面读取、REST API 通用调用、Markdown/HTML 上传、附件、标签、评论和页面下载。
- Markdown/HTML 上传支持 Mermaid 默认 PNG 附件渲染、双 TOC 宏、dry-run 预览与 `confirm=true` 写入保护。
- Skill 与 README 记录完整页面发布默认携带 `--toc` 的标准流程。
- 工程化补齐 Vitest、release smoke、bin 权限修复、lefthook、GitHub Pages、npm publish、安装/更新命令、更新探针、角色 bin、静态文档页和 README 封面资产。
- 顶层内置 `install` / `update` / `upgrade` / `uninstall` / `remove` 命令（`npx -y @cloudglab/confluence-cli@latest install`），对齐 `zentao-cli`：
  - `runUninstallCommand` 支持 `--confirm`、`--keep-config`、`--cli-only`、`--skill-only` 预览与真实执行。
  - `install` / `update` 链路上增加 npm 全局残留目录与 `~/.npm/_npx` 缓存的清理与重试，应对 `ENOTEMPTY` / `directory not empty` 失败。
  - `npx -y skills add` 采用 `npx -y skills add <source> --yes` 形式，支持 `npx -y skills remove confluence-cli --yes`。
  - 安装 / 更新成功后写入 `~/.confluence/update-check.json`；后台版本检查改为解绑子进程。
- ZenTao 风格的 `.opencode/opencode.json` 项目级 OpenCode 命令：包含 `release` 发布流程与 `smoke` 烟测提示。
- `skills/confluence-cli/SKILL.md` 自带合规 YAML frontmatter（`name` + `description`），可直接 `npx -y skills add` 安装。
- 单元测试覆盖：`uninstall` 预览、新版 update probe 缓存命中与 `writeUpdateCacheAfterInstall` 写盘路径、SKILL.md frontmatter 回归校验。

### Notes

- 0.0.1 是项目对外的第一个版本，发布前已通过 `pnpm check`（lint / typecheck / 61 项 vitest）与 `pnpm release:smoke-query --dry-run`（40 通过、6 跳过、0 失败），并本地真实调用 `npx -y skills add <source> --yes` 验证 install 链路。
- `.github/workflows/publish.yml` 只负责 tag push 后的 `npm publish --provenance --access public`，不创建 GitHub Release。
- tarball 用 `!dist/**/*.map` 排除 source map，发布前 `npm pack --dry-run` 仅 100 个文件、1.3 MB。
