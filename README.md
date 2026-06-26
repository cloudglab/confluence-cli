# confluence-cli

![confluence-cli](./assets/readme/confluence-cli-hero.png)

Confluence REST CLI，提炼自 `confluence-skill` 的常用能力，并按 `zentao-cli` 的 TypeScript CLI 架构实现。

## 安装与开发

```bash
pnpm install
pnpm build
pnpm dev help
pnpm dev --version          # 当前 CLI 版本，与 alpha-cli 等 CLI 对齐
```

常用工程命令：

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm release:smoke-query --dry-run
```

Mermaid 渲染默认使用 `beautiful-mermaid-cli` 的 `bm` 命令。它通过纯 JS + WASM 渲染 SVG/PNG，不依赖 Chrome、Chromium、Puppeteer 或原生编译工具链；安装/更新时会自动执行 `npm install -g beautiful-mermaid-cli@latest`。

由于 `beautiful-mermaid-cli` 要求 Node.js 20+，本项目运行要求也同步提升到 Node.js 20+。如果自动安装失败，上传时仍可传 `--mermaid none` 保留 Mermaid 代码块。

Mermaid 目前仍有一个已知限制：内置渲染器不支持 `%%{init: ...}%%` 主题头；遇到这类图时，CLI 会直接报出明确提示。此时建议先用 `mmdc` 单独渲染成 PNG，再在 Markdown/HTML 里引用图片上传。

当前版本还补齐了 `zentao-cli` 风格的账号快捷命令：`confluence whoami`、`confluence who-am-i`，以及口语化输入 `confluence who am i`。这三个命令走专用渲染（`formatWhoami`），返回多行易读文本（显示名 / 用户名 / `userKey` / 邮箱 / 类型 + 快捷入口提示），不再拍平成单行 JSON；底层仍是 `getCurrentUser`（原始 JSON）。

安装成功后的 ASCII banner 现在固定使用仓库内置模板，终端里更容易保持左右对齐，减少字符画偏移。

`install` / `update` 在以下情况会**继续完成安装**而不是中断：

- `beautiful-mermaid-cli` 安装失败时，会打印 `已跳过 beautiful-mermaid-cli 安装：<原因>` 与 `后续如需 Mermaid 图片渲染，可稍后重试安装，或在上传时传 --mermaid none 保留代码块。`。
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

> `install` / `update` 默认对齐 `zentao-cli`，直接执行 `npx -y skills add <source> --yes`，不再额外传 `--global`。CLI 仍是全局安装，skill 来源仍取自全局已安装包；`confluence uninstall --confirm true` 会同时清理项目级与全局级残留。

> `uploadMarkdown` 现在固定走内化后的 markfluence AST 转换链路：先解析 Markdown 为 mdast，再由内部 `parser + registry + converter + elements/*` 输出 Confluence storage XHTML，不再走旧的 wiki 回退分支。上传前仍会保留 Mermaid 预渲染、重复表头清理、代码块外花括号转义等预处理；若文档仍有复杂表格或需要完全自定义代码块/图片宏，可改走 `uploadHtml --forceReupload --attachments ...`。

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
confluence whoami
confluence searchContent --cql 'space = "DEV" AND text ~ "API"'
confluence getContent --id 123456
confluence getComments --id 123456
confluence addComment --id 123456 --body 'LGTM' --confirm true
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
confluence report --period day
confluence report --period week --space DEV --limit 50
confluence getPageSnapshot --id 12345
confluence searchContent --cql 'space = "DEV"' --output normal
confluence getContent --id 12345 --output verbose

# URL 解析（显式 + 隐式入口）
confluence urlParse --url 'https://cf.cloudglab.cn/pages/viewpage.action?pageId=5278156'
confluence 'https://cf.cloudglab.cn/wiki/spaces/GABI/pages/5278156/GA-BI'   # 首参 URL 自动走 urlParse
confluence 'https://cf.cloudglab.cn/wiki/spaces/GABI/pages/5278156/GA-BI#comment-12345'  # 评论
confluence 'https://cf.cloudglab.cn/download/attachments/5278156/diagram.png?version=2'  # 附件
```

## 输出模式（AI 友好）

CLI 默认输出针对 Agent / Skill 优化：单行不缩进 JSON，handler 返回时由框架层按当前 `--output` 模式注入 `meta`，所有错误信息、`UNSUPPORTED_WRITE_ACTIONS` 拒绝原因、命令元数据渲染均带候选值或下一步建议。

```bash
# 三档模式
confluence list --output compact          # 默认：紧凑 JSON，不裁剪任何字段或数组；不注入 meta
confluence listRestApis --output normal   # 不裁剪；自动抽 source/partial/page/limit/total/scanned 组成 meta
confluence getContent --id 12345 --output verbose  # 原样返回（单行）

# 短链路 Agent 探测
confluence findContent --title "Foo" --space DEV
confluence getPageSnapshot --id 12345     # 5 个并行 GET 一次拿到页面完整画像
confluence report --period day            # 列今天的日报
```

`compact` 不再裁剪 `items` 数组前 20 / 大字符串前 600，只控制 JSON 形态（单行不缩进）；与 `normal` 的差异收敛到"是否注入 `meta`"，与 `verbose` 的差异是"是否原样返回"。对 Agent / Skill 来说：默认 `compact` 拿到的是完整数据，需要分页元信息时切换到 `normal`，排查时切到 `verbose`。

`help <command>` 末尾会自动渲染 `Agent hints:` 段，写明 `Approx cost: <costHint>` 与 `Suggested next: <nextBestTools>`，方便 Agent 决策下一步。

## URL 解析

把 Confluence 网页 URL 直接喂给 CLI，自动推断用户意图并给主命令 + 备选。两层入口：显式 `urlParse --url <URL>` 与首参 URL 隐式（`pnpm dev:reader <URL>`）。

支持 13 种路由：`page` / `space` / `edit` / `comment` / `history` / `search` / `attachment` / `folder` / `api` / `dashboard` / `tiny link` / `unknown` 等。`pageId` / `spaceKey` / `attachmentId` / `folderId` / `shortCode` 等业务字段名语义化解析，非 raw `:id`。

`matchedServer` 严格比对主机：默认从 `CONFLUENCE_URL` / `~/.confluence/config.json` 推断期望 host；不匹配仍解析 + 标 `false`，`note` 提示跨域可能受限；显式 `--requireMatchedServer true` 可强制要求匹配。

已知限制：`/x/<SHORTCODE>` 是 Confluence Cloud 私有短码（`unknown` + `shortCode` 参数），需 HEAD 在线解码或服务端解析；历史版本号在 `viewpreviousversions.action?pageId=X` 解析不出，需 `getContent --expand version`。

## HTTP 客户端

`ConfluenceHttpClient` 对齐 `zentao-cli` 的连接复用与缓存策略：

- `httpAgent` / `httpsAgent` 启用 `keepAlive: true`，复用连接，减少高频探测期握手开销。
- GET 15 秒内存缓存，按 `(method, path, sortedParams)` 命中；LRU + `maxSize=128`，避免无限增长；命中时 `meta.cacheHits` 自动 +1，重复探测期不重发请求。
- 网络层错误（`ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / `ECONNREFUSED` / `EPIPE`）重试 1 次（间隔 100ms）；HTTP 4xx / 5xx 直接抛错，不重试。
- Basic 模式 401 自动重试 1 次（清 auth 字段后让 axios 重新发起 challenge）；PAT 模式不重试 401（Bearer 写死在 headers，"清 token" 等价于 no-op，且改共享 axios defaults 会污染并发请求）。
- 大附件走流式 `downloadToFile`，用 `node:stream/promises.pipeline` 直接落盘，避免全量 `Buffer` 进内存；失败时清理半成品文件。
- 错误响应体预览截前 500 字符（`…(N bytes)`），避免巨型 HTML / JSON 错误页爆日志。

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
- Markdown/HTML 上传时默认用 `beautiful-mermaid-cli` 将 Mermaid 渲染为 PNG 附件并以内置图片宏展示，必要时可用 `--mermaid none` 保留原代码块
- `uploadMarkdown` 的 storage 转换链路已内化 markfluence 风格的 registry / converter 设计，输出 Confluence storage XHTML，同时保留当前 CLI 的 Mermaid、附件和写保护能力
- mark 风格 metadata 生成
- Markdown 上传预览、确认写入和附件上传
- 页面下载为带 frontmatter 的 Markdown，并可下载附件和一层子页
- 工程化脚本：Vitest 单元测试、发布前查询 smoke、bin 权限修复、CHANGELOG 和 lefthook 检查入口
- 安装/更新命令、每日更新探针、角色 bin 入口、静态命令速查页和 README 封面资产
- AI 友好输出：`--output compact|normal|verbose` 三档模式、列表型 `ListResult` 包装、命令元数据 `Agent hints:` 段、HTTP 15s 缓存 + 网络重试 + metrics 注入、`UNSUPPORTED_WRITE_ACTIONS` 高危拦截、`getPageSnapshot` 短链路命令、`report` 周期查询命令

## 项目级 OpenCode 命令

`.opencode/opencode.json` 提供了两个项目级 OpenCode 命令：

- `release`：复刻 zentao-cli 的 `/release` 流程，按 14 步固定顺序准备发布；默认手动发包，**未经再次授权不会执行 `npm publish`、`git push`、打 tag 或创建 GitHub Release**。
- `smoke`：检查当前 CLI 的烟测与验证入口（`pnpm release:smoke-query --dry-run`、`pnpm typecheck`、`pnpm build` 等）。

修改 `.opencode/opencode.json` 后，需要退出并重启 OpenCode 才能生效。
