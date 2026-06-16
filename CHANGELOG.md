# Changelog

All notable changes to this project will be documented in this file.

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
