# Changelog

All notable changes to this project will be documented in this file.

## 0.0.10 - 2026-06-22

### 新增

- 新增独立解析器 `src/core/url-parser.ts`（332 行）：从 Confluence 网页 URL 推断用户意图，返回结构化 `ParsedUrl`（`originalUrl` / `parsed.{host,pathname,search,hash}` / `matchedServer` / `routeKind` / `params` / `primaryCommand` / `suggestedCommands` / `note`），覆盖 13 种路由（`page` / `space` / `edit` / `comment` / `history` / `search` / `attachment` / `folder` / `api` / `dashboard` / `tiny link` / `unknown`）。参数语义化使用业务字段名（`pageId` / `spaceKey` / `attachmentId` / `folderId` / `shortCode`）而非 raw `:id`。
- 新增显式命令 `urlParse`（`src/tools/metadata.ts` + `src/core/tool-registry.ts`），`help` 末尾标注 `costHint: 0 REST 请求(纯字符串解析,不发请求)` + `nextBestTools: getContent / getSpace / searchContent`，`AGENTS.md` 增"URL 解析"章节。
- 隐式入口：`src/cli.ts:parseCli` 在 `normalizeCommandAlias` 之后检测首参 URL（`looksLikeUrl`），自动重写为 `urlParse`，用户可直接 `pnpm dev:reader <URL>` 触发解析。
- 13 种 `routeKind` 与主命令映射：`page → getContent`、`space → getSpace`、`search → searchContent`、`attachment → downloadAttachment`、`edit → getContent`（只读,改写走 `uploadMarkdown` / `uploadHtml`）、`history → getContent --expand version`、`api → callRestApi`、`dashboard / folder / tiny link / unknown` 保守给候选 + `note` 说明。

### 变更

- `defaultExpectedHost()` 两步回退：先读 `process.env.CONFLUENCE_URL`，缺失时调 `loadConfluenceConfig()` 从 `config.url` 转 host；任一失败（凭证缺失等）静默返回 `undefined`，URL 解析不阻塞。主机严格相等比较（`url.host === expected`），不匹配时 `matchedServer` 标 `false` 但仍继续解析，`note` 自动追加 `主机不匹配(标 matchedServer=false,主命令仍可试,但跨域可能受限)。`
- 新增 `requireMatchedServer` 选项：开启后主机不匹配直接抛错（错误信息带候选值，便于 Agent 自我修复：`URL 主机 X 与期望 Y 不一致(可省略该检查或传 expectedHost 强制解析)。`）。
- `parseConfluenceUrl` 自动补 scheme（无 `https://` 时补默认）；支持剥 `/wiki` / `/confluence` base path（Cloud / DC 通用）；`safeDecode` 兜底 `decodeURIComponent` 防非法编码。

### 测试

- 新增 `tests/core/url-parser.test.ts`（45 个 it 块）覆盖 13 种 `routeKind`、`matchedServer` 三态（env / config / 显式 `expectedHost` / 主机不匹配）、边界（raw path / 空字符串 / 无效 URL / base path 剥除 / 中文文件名）、`looksLikeUrl`（`https?://` / `atlassian.net` / `cloudglab.cn` / `confluence.` / 普通字符串）、`requireMatchedServer` 抛错、`defaultExpectedHost` env 优先与非 URL 不抛、`unknown` 保留 `rawPath` 调试。

## 0.0.9 - 2026-06-22

### 新增

- 借鉴 `zentao-cli` 的"AI 友好"设计，新增 `--output compact|normal|verbose` 三档输出模式：`compact`（默认）输出单行不缩进 JSON，数组 >20 截前 20 并保留 `total` 标记，`content` / `data` / `raw` / `html` / `text` / `message` 字段字符串 >600 截前 600 加 `…`；`normal` 不裁剪，自动从结果中抽取 `source` / `partial` / `page` / `limit` / `total` / `scanned` / `durationMs` / `cacheHit` / `fallbackUsed` 组成 `meta`；`verbose` 原样返回（单行）、不注入 `meta`。
- HTTP 层优化：GET 请求新增 15 秒内存缓存（按 method + path + sortedParams 命中），POST/PUT/DELETE 不缓存；`ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / `ECONNREFUSED` / `EPIPE` 五类网络层错误自动重试 1 次（间隔 100ms）；模块级累计 `requestCount` / `cacheHits` / `retries` / `errors` / `durationMs`，由 `runCli` 在每次 handler 调用前后 `resetMetrics()` 并在结果末尾自动注入 `meta`，重复探测期减少 token 浪费。
- 命令元数据：22 个核心命令（`whoami` / `initConfluence` / `listSpaces` / `getSpace` / `searchContent` / `getContent` / `findContent` / `report` / `getPageSnapshot` / `getPageChildren` / `getComments` / `addComment` / `deleteContent` / `addLabels` / `deleteLabel` / `getLabels` / `listAttachments` / `uploadAttachment` / `updateAttachment` / `downloadAttachment` / `uploadMarkdown` / `uploadHtml` / `downloadPage` / `callRestApi` / `listRestApis`）的 `COMMAND_METADATA` 表集中维护 `costHint` / `nextBestTools` / `cacheable` / `idempotent`，`help <command>` 末尾渲染 `Agent hints:` 段；写操作额外带 `Cache: bypassed` / `Idempotent: no (写操作,需要 --confirm true)` 两行。
- 列表型结果结构：新增 `listResult(items, meta)` 工厂（`src/core/list-result.ts`），`searchContent` / `findContent` / `report` / `listSpaces` 四个核心 handler 返回统一的 `{ source, partial, page, limit, total, scanned?, itemKey, items }` 结构；`itemKey` 显式标注 `items[i]` 的语义名（`results` / `pages` / `spaces`），让 Agent 一眼看清分页元信息。
- 短链路命令 `getPageSnapshot`：把 5 个并行 GET（`getContent` + `getLabels` + `getComments` + `listAttachments` + `getPageChildren`）收成一次调用，返回 `focus`（id / title / type / space / version / ancestors）+ `text`（body 预览，可调长度，默认 1500 字符）+ `labels` + `summary`（4 个 count）+ 3 段 highlights（comments / attachments / children），适合 Agent 首轮探测单页完整画像。
- 写保护：新增 `UNSUPPORTED_WRITE_ACTIONS` 表（`src/core/write-guard.ts`），先于 `--confirm` / 全局禁写检查生效；目前拦截 `callRestApi:DELETE`（Confluence DELETE 多为不可逆，CLI 不暴露）。
- 新增命令 `report`：基于 `/content/search` + CQL 日期函数，支持 `--period day|week|month|quarter` 以及 `--from` / `--to` 自定义时间窗，可叠加 `--space` / `--type` / `--creator` 过滤。

### 变更

- `jsonResult` 签名升级为 `jsonResult(value, mode?)`，默认走全局 mode（由 `--output` 控制），保持向后兼容（10 个 tools 文件的旧调用零改动）。
- `parseCli` 早期解析 `--output`，非法值抛 `无效 output mode: X（需要 compact|normal|verbose）`，空值抛 `--output 需要一个值`，错误信息带候选值便于 Agent 自我修复。
- `rest.ts` 中 `action` 短化为 `callRestApi:${method}`，便于 `UNSUPPORTED_WRITE_ACTIONS` 表按 method 维度命中；完整 `endpoint.path` 保留在 payload 里，诊断信息不丢。

### 说明

- AGENTS.md 新增"Agent 推荐读法"章节，集中说明输出模式、写保护、短链路调用模板、输出后处理、列表型结果结构、命令元数据、HTTP 层优化与 `UNSUPPORTED_WRITE_ACTIONS` 维护约定。
- 所有新错误信息、`UNSUPPORTED_WRITE_ACTIONS` 拒绝原因、命令元数据渲染均带候选值或下一步建议，贴合 Agent / Skill 消费的"如何修复"语义。

## 0.0.8 - 2026-06-18

### 变更

- `uploadMarkdown` 的 storage 转换链路改为内化 `markfluence` 的 AST 模块：`markdownToStorage()` 现在通过 `src/utils/markfluence/` 下的 `parser`、`registry`、`converter` 和 `elements/*` 输出 Confluence storage XHTML，不再依赖 `markdown.ts` 内嵌的大型 token switch。
- `uploadMarkdown` 入口固定走上述 storage 主路线，不再保留旧的 wiki / storage 二选一分支；help 文本同步收敛为 “上传 Markdown 为 Confluence storage 页面”。
- 保留当前项目自己的 `beautiful-mermaid-cli` (`bm`) Mermaid 预渲染、附件上传、写保护与 wiki fallback，不引入 `markfluence` 的 Chromium / Puppeteer Mermaid 路线。
- `install` / `update` 默认重新对齐 `zentao-cli`，执行 `npx -y skills add <source> --yes`，不再额外追加 `--global`；当显式开启 `--skill-global` 时同步注入 `--agent universal`，避免自动探测到不支持全局安装的 agent。
- 新增 Mermaid 已知限制检测：内置渲染器在遇到 `%%{init: ...}%%` 主题头时直接给出明确提示，不再静默渲染失败；建议先用 `mmdc` 单独渲染成 PNG 后再在 Markdown/HTML 中引用图片。

### 测试

- `tests/utils/markdown.test.ts` 与 `tests/tools/transfer.test.ts` 覆盖新的 AST storage 转换链路，以及 `uploadMarkdown` preview 固定返回 `representation: "storage"` 的行为。
- `tests/install.test.ts` 同步默认安装、npm 包回退安装与本地路径安装的 `skills add` 参数断言。

## 0.0.7 - 2026-06-17

### 修复

- 安装成功提示中的 ASCII banner 调整为固定多行模板，减少终端里因行宽不一致造成的视觉偏移。

### 测试

- `tests/install.test.ts` 同步安装成功 banner 相关断言。

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
