# Changelog

All notable changes to this project will be documented in this file.

## 0.0.2 - 2026-06-16

### Fixed

- `createSkillAddArgs` 默认向 `npx -y skills add <source> --yes` 追加 `--global`，让 `npx -y @cloudglab/confluence-cli@latest install` 把 skill 装到 user-level 全局目录（`vercel-labs/skills` 的 `-g, --global` 选项）。修复 `npx ... install` 在 npx 临时目录里跑完被清理、导致 agent 找不到 skill 的问题。
- `tests/install.test.ts` 同步更新 3 处 `npx -y skills add` 期望参数为 `--global --yes`，覆盖默认安装、`--skill-source=npm` 与 `--skill-local-path` 三条路径。

### Notes

- `runUninstallCommand` 链路已经通过 `createSkillRemoveArgs(true)` 覆盖全局 skill 清理，升级到 0.0.2 后 `confluence uninstall --confirm true` 会同时清理项目级与全局级残留，幂等。
- 0.0.1 → 0.0.2 升级仅影响 `npx ... install` / `npx ... update` 触发的 skill 安装路径，已经在 0.0.1 装到项目级的用户可以重新执行 `npx -y @cloudglab/confluence-cli@latest install` 让 skill 迁回全局。

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
