# confluence-cli

![confluence-cli](./assets/readme/confluence-cli-hero.png)

Confluence REST CLI，提炼自 `confluence-skill` 的常用能力，并按 `zentao-cli` 的 TypeScript CLI 架构实现。

## 安装与开发

```bash
pnpm install
pnpm build
pnpm dev help
```

常用工程命令：

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm release:smoke-query --dry-run
```

从 `0.0.4` 起，Mermaid 渲染不再依赖 `@mermaid-js/mermaid-cli`。CLI 安装/更新时会自动安装 `coolamit/mermaid-cli` 提供的原生二进制 `mmd-cli`，避开 Puppeteer/Chrome 下载链路，并在卸载时清理常见安装位置下的 `mmd-cli` 二进制。

`mmd-cli` 运行时仍需要系统已有 Chrome/Chromium；如果机器完全没有浏览器，可在上传时传 `--mermaid none`，保留 Mermaid 代码块。

从 `0.0.5` 起，`install` / `update` 在以下两种情况会**继续完成安装**而不是中断：

- `mmd-cli` 官方安装脚本因网络问题失败时，会打印 `已跳过 mmd-cli 安装：<原因>` 与 `后续如需 Mermaid 图片渲染，可稍后重试安装，或在上传时传 --mermaid none 保留代码块。`。
- 全局包内 `skills/confluence-cli` 缺失时，会打印 `未找到已安装包内的 Confluence skill：<path>，正在自动回退到 npm 包解压安装...` 并自动用 `npm pack` + `tar` + `npx -y skills add` 完成 skill 安装，无需手动切换 `--skill-source npm`。

安装/更新入口：

```bash
confluence install --skip-config-check true
confluence update --skip-config-check true
npx -y @cloudglab/confluence-cli@latest install
npx -y @cloudglab/confluence-cli@latest update
confluence-reader list
confluence-writer list
```

> `install` / `update` 默认走 `vercel-labs/skills` 推荐的项目级安装（`cwd` 下 agent skills 目录，兼容所有 agent，包括不支持全局的 PromptScript）。需要 user-level 全局时显式传 `--skill-global`（仅当 agent 支持，如 Claude Code / Cursor / OpenCode）。`confluence uninstall --confirm true` 会同时清理项目级与全局级残留。

卸载入口（默认仅打印卸载计划，真实执行需显式确认）：

```bash
confluence uninstall
confluence uninstall --confirm true
confluence uninstall --confirm true --keep-config true
npx -y @cloudglab/confluence-cli@latest uninstall --confirm true
```

本地命令速查页：`docs/index.html`。

## 配置

推荐使用环境变量或 `.env.confluence`：

```bash
CONFLUENCE_URL=https://confluence.example.com
CONFLUENCE_PAT=your-personal-access-token
```

Confluence Server/Data Center 7.13.7 的 Personal Access Token 使用 `Authorization: Bearer <token>`。CLI 也保留 Basic 兼容模式：`CONFLUENCE_USERNAME` + `CONFLUENCE_PASSWORD` 或 `CONFLUENCE_API_TOKEN`。

CLI 会按顺序查找：显式 `envFile`、环境变量、当前/父目录 `.env`、`.env.confluence`、`.env.jira`、`.env.atlassian`、Home 目录同名文件、MCP 配置。

## 命令示例

```bash
confluence list
confluence searchContent --cql 'space = "DEV" AND text ~ "API"'
confluence getContent --id 123456
confluence listRestApis --group content
confluence listRestApis --group content --limit 20
confluence callRestApi --method GET --path '/content/{id}' --pathParams '{"id":"123456"}' --query '{"expand":"body.storage,version"}'
confluence convertMarkdownToWiki --file docs/page.md
confluence convertMermaidToDrawio --file docs/diagram.md
confluence convertMermaidToDrawio --text 'graph TD\n  A-->B' --output /tmp/demo.drawio
confluence generateMarkMetadata --file docs/page.md --space DEV --title "API Guide"
confluence uploadMarkdown --file docs/page.md --space DEV --toc --confirm false
confluence uploadMarkdown --file docs/page.md --id 123456 --attachments '["docs/a.png"]' --toc --confirm true
confluence uploadMarkdown --file docs/page.md --id 123456 --mermaid png --toc --confirm true
confluence downloadPage --id 123456 --outputDir exports --downloadAttachments true --downloadChildren true
confluence getPageChildren --id 123456 --type page
confluence getLabels --id 123456
confluence addLabels --id 123456 --labels '["api","docs"]' --confirm true
confluence listAttachments --id 123456
confluence uploadAttachment --id 123456 --file docs/a.png --confirm true
```

## Confluence 7.13.7 REST API 对齐

`docs/confluence-7.13.7-api.md` 记录了从官方 `https://docs.atlassian.com/ConfluenceServer/rest/7.13.7/` 提取的全量 REST API。

CLI 通过两个通用命令对齐所有端点：

- `listRestApis`：按 `method`、`group`、`write` 过滤官方端点模板。
- `callRestApi`：按官方端点模板调用 API；所有写接口仍必须显式传 `confirm=true`。

## 写操作保护

`uploadMarkdown`、`deleteContent`、`addComment`、`addLabels`、`deleteLabel`、`uploadAttachment`、`updateAttachment` 默认不会写入 Confluence。只有传入 `confirm=true` 时才会执行真实写操作。

如需在自动化环境中临时禁止所有真实写操作，可设置：

```bash
CONFLUENCE_DISABLE_WRITE=true
```

如需关闭启动时的每日更新探针，可设置：

```bash
CONFLUENCE_SKIP_UPDATE_CHECK=true
```

发布前可先运行 `pnpm release:smoke-query --dry-run` 检查 CLI 命令面；需要真实查询时先 `pnpm build`，再按需设置 `CONFLUENCE_SMOKE_CONTENT_ID`、`CONFLUENCE_SMOKE_SPACE`、`CONFLUENCE_SMOKE_TITLE` 等变量。

## MCP / Python 能力的 TS CLI 对应

| 原 skill 能力 | 当前 CLI 命令 |
| --- | --- |
| `confluence_search` | `searchContent` |
| `confluence_get_page` | `getContent`, `findContent` |
| `confluence_create_page` / `confluence_update_page` | `uploadMarkdown` |
| `confluence_delete_page` | `deleteContent` |
| `confluence_get_page_children` | `getPageChildren` |
| `confluence_get_comments` / `confluence_add_comment` | `getComments`, `addComment` |
| `confluence_get_labels` / `confluence_add_label` | `getLabels`, `addLabels`, `deleteLabel` |
| Python Markdown 上传脚本 | `uploadMarkdown --attachments ...` |
| Python 下载脚本 | `downloadPage --downloadAttachments true --downloadChildren true` |
| Python 附件处理 | `listAttachments`, `uploadAttachment`, `updateAttachment`, `downloadAttachment` |
| mark metadata 脚本 | `generateMarkMetadata` |

## 已迁移能力

- Confluence 凭证发现
- CQL 搜索与页面读取
- Confluence 7.13.7 全量 REST API 端点注册与通用调用
- MCP 页面/子页/评论/标签能力的语义化 CLI 命令
- Markdown 转 Confluence Wiki Markup
- Markdown/HTML 上传时默认用 `mmd-cli` 将 Mermaid 渲染为 PNG 附件并以内置图片宏展示，必要时可用 `--mermaid none` 保留原代码块
- mark 风格 metadata 生成
- Markdown 上传预览、确认写入和附件上传
- 页面下载为带 frontmatter 的 Markdown，并可下载附件和一层子页
- 工程化脚本：Vitest 单元测试、发布前查询 smoke、bin 权限修复、CHANGELOG 和 lefthook 检查入口
- 安装/更新命令、每日更新探针、角色 bin 入口、静态命令速查页和 README 封面资产

## 项目级 OpenCode 命令

`.opencode/opencode.json` 提供了两个项目级 OpenCode 命令：

- `release`：复刻 zentao-cli 的 `/release` 流程，按 14 步固定顺序准备发布；默认手动发包，**未经再次授权不会执行 `npm publish`、`git push`、打 tag 或创建 GitHub Release**。
- `smoke`：检查当前 CLI 的烟测与验证入口（`pnpm release:smoke-query --dry-run`、`pnpm typecheck`、`pnpm build` 等）。

修改 `.opencode/opencode.json` 后，需要退出并重启 OpenCode 才能生效。
