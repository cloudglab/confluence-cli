# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2026-06-12

### Added

- 初始 Confluence REST CLI，覆盖配置发现、CQL 搜索、页面读取、REST API 通用调用、Markdown/HTML 上传、附件、标签、评论和页面下载。
- Markdown/HTML 上传支持 Mermaid 默认 PNG 附件渲染、双 TOC 宏、dry-run 预览与 `confirm=true` 写入保护。
- Skill 与 README 记录完整页面发布默认携带 `--toc` 的标准流程。
- 工程化补齐 Vitest、release smoke、bin 权限修复、lefthook、GitHub Pages、npm publish、安装/更新命令、更新探针、角色 bin、静态文档页和 README 封面资产。

## 0.1.2 - 2026-06-15

### Fixed

- 修复 `npx -y skills add` 安装失败：发布出去的 `skills/confluence-cli/SKILL.md` 缺少 `npx skills` 要求的 YAML frontmatter（`name` + `description`），导致 `confluence install` / `confluence update` 永远停在 `No valid skills found. Skills require a SKILL.md with name and description.`。补上 frontmatter 后 `npx -y skills add <source> --yes` 安装成功。

### Notes

- 0.1.0、0.1.1 已被 `npm deprecate` 标弃用，请升级到 0.1.2 及以上。
- 发布前本地已真实调用 `npx -y skills add <source> --yes` 验证通过，避免再发生“CI 通过、用户安装失败”的盲点。

## 0.1.1 - 2026-06-15

### Changed

- 安装 / 更新链路从 zentao-cli 学过来：`install`、`update`、`upgrade`、`uninstall`、`remove` 直接作为顶层内置命令运行，无需先 `npx` 拉一次。
- 引入 `runUninstallCommand`，支持 `--confirm`、`--keep-config`、`--cli-only`、`--skill-only` 预览与真实执行；未传 `--confirm` 时仅打印卸载计划。
- `install` / `update` 链路上增加 npm 全局残留目录与 `~/.npm/_npx` 缓存的清理与重试，应对 `ENOTEMPTY` / `directory not empty` 失败。
- `npx -y skills add` 改用 ZenTao 同款 `npx -y skills add <source> --yes` 形式，并支持 `npx -y skills remove confluence-cli --yes`。
- 安装 / 更新成功后写入 `~/.confluence/update-check.json`，减少每日自动检查的 npm 抖动；后台版本检查改为解绑子进程，不再阻塞命令返回。

### Added

- 顶层命令 `confluence uninstall` / `confluence remove`，对应 `--cli-only`、`--skill-only`、`--keep-config`、`--confirm` 组合。
- 顶层 `confluence upgrade` 别名指向 `confluence update`；`confluence remove` 别名指向 `confluence uninstall`。
- 顶层帮助 / `list` 列表在“开始使用”分组里登记 `install`、`update`、`upgrade`、`uninstall`、`remove`。
- ZenTao 风格的 `.opencode/opencode.json` 项目级 OpenCode 命令：包含 `release` 发布流程与 `smoke` 烟测提示。
- 单元测试覆盖 `uninstall` 预览、新版 update probe 缓存命中与 `writeUpdateCacheAfterInstall` 写盘路径。

### Notes

- `.github/workflows/publish.yml` 仍只负责 tag push 后的 `npm publish --provenance --access public`，不创建 GitHub Release，与手动发包策略保持一致。
- tarball 仍以 `!dist/**/*.map` 排除 source map，本次 100 个文件、1.3 MB。
