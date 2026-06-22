# confluence-cli

面向 Agent 和本地自动化的 Confluence REST CLI。整体结构参考 `zentao-cli`：命令注册表、工具分层、REST API 封装、结果统一为 JSON content。

## 开发约定

- README 面向用户，AGENTS 放实现细节。
- 真实写操作必须显式传 `confirm=true`；没有确认时只返回预览或 dry-run 信息。
- 不要提交代码，除非用户明确要求。
- 优先运行轻量验证：`pnpm typecheck`、`pnpm build`。

## Agent 推荐读法

面向 Agent / Skill 消费的输出约定。整体借鉴自 `zentao-cli` 的 `--output compact|normal|verbose` 三档模式。

### 输出模式（默认 `compact`）

所有 handler 返回 JSON 时都会按当前全局 mode 裁剪，单行不缩进（默认 AI 最省 token）。

- `compact`（默认）：数组 >20 截前 20 + 标记 `total`；`content` / `data` / `raw` / `html` / `text` / `message` 字符串 >600 截前 600 + `…`；不注入 `meta`。**适合 Agent 首轮探测**。
- `normal` ：不裁剪；自动从结果里抽取 `source` / `partial` / `page` / `limit` / `total` / `scanned` / `durationMs` / `cacheHit` / `fallbackUsed` 组成 `meta`。**适合分页元信息查询**。
- `verbose`：原样返回（单行）；不注入 `meta`。**适合全字段排查**。

切换方式：

```bash
pnpm dev:reader --output compact searchContent --cql '...'
pnpm dev:reader --output normal  listRestApis --limit 10
pnpm dev:reader --output verbose getContent 12345
```

错误用法直接抛错并给出提示：

- `--output bogus` → `无效 output mode: bogus（需要 compact|normal|verbose）`
- `--output`（无值） → `--output 需要一个值`

### 写保护

- 真实写操作必须显式传 `confirm=true`，否则只返回 `preview: true` 的诊断。
- 全局禁写：`export CONFLUENCE_DISABLE_WRITE=true`，即使传 `confirm=true` 也只返回预览。
- reader 角色（`pnpm dev:reader`）只能跑只读命令，写命令会被剔除；如需写操作请用 `pnpm dev:writer` 或 `pnpm dev`。

### 短链路调用模板

- 找一篇页面：`pnpm dev:reader findContent --title "Foo" --space DEV`
- 拿到正文：`pnpm dev:reader getContent 12345 --expand body.storage,version,metadata.labels`
- 单次拿到页面快照（focus + body + labels + comments + attachments + 子页）：`pnpm dev:reader getPageSnapshot 12345`
- 列最近日报：`pnpm dev:reader report --period day`
- 跨页搜：`pnpm dev:reader searchContent --cql 'space = "DEV" AND text ~ "API"' --limit 10`

### 输出后处理

CLI 输出是单行 JSON，可直接 `| jq` 或 `| python -m json.tool` 做人类可读格式化：

```bash
pnpm dev:reader searchContent --cql '...' --limit 5 | jq '.results[:3]'
```

### 相关源码

- 输出模式：`src/utils/output-mode.ts`
- `jsonResult` + `withToolMeta`：`src/utils/result.ts`
- `--output` 解析：`src/cli.ts` 的 `parseCli`

### 列表型结果结构（`listResult`）

列表类命令（`searchContent` / `findContent` / `listSpaces` / `report` / `getLabels` / `listAttachments` / `getPageChildren` / `getComments` 等）返回统一结构，让 Agent 一眼看清分页元信息：

```json
{
  "source": "rest",
  "page": 1,
  "limit": 25,
  "total": 100,
  "scanned": 100,
  "itemKey": "results",
  "items": [ ... ],
  "partial": true
}
```

字段含义：

- `source` — 数据来源（`"rest"` / `"cql"` / `"local"`）
- `partial` — `items` 是否是全集（分页时为 `true`，一次性返回全量为 `false`）
- `page` / `limit` / `total` — 分页元信息，配合 `start/limit` 参数可继续翻页
- `itemKey` — `items[i]` 的语义名（`"pages"` / `"spaces"` / `"results"` / `"labels"` / `"attachments"` / `"comments"` / `"children"`），让 Agent 知道怎么取
- `items` — 列表本体

普通模式（`--output normal`）会自动把 `source/partial/page/limit/total/scanned` 抽到 `meta` 段（顶层字段仍在，避免破坏结构）。

### 命令元数据（`costHint` / `nextBestTools`）

执行 `pnpm dev:reader help <command>`，命令末尾会渲染"Agent hints"段：

```
Agent hints:
  Approx cost: 1 REST 请求(15s 缓存)
  Suggested next: confluence findContent, confluence getContent, confluence report
```

写操作还会多两行：

```
  Cache: bypassed
  Idempotent: no (写操作,需要 --confirm true)
```

元数据集中维护在 `src/core/tool-registry.ts` 的 `COMMAND_METADATA` 表，新增核心命令时按相同模式补一行即可。

### HTTP 层优化（zentao-cli 借鉴）

`ConfluenceHttpClient`（`src/core/http.ts`）做了三层 AI 友好的优化：

- **GET 15s 缓存**：按 `(method, path, sortedParams)` 命中 `Map`，TTL 15s。重复探测期减少 token 浪费。POST/PUT/DELETE 不缓存。
- **网络错误重试 1 次**：`ECONNRESET` / `ETIMEDOUT` / `EAI_AGAIN` / `ECONNREFUSED` / `EPIPE` 这五类 axios 网络层错误重试 1 次（间隔 100ms）。HTTP 4xx/5xx 不重试（语义明确，交给上层处理）。
- **指标累计**：`src/core/http-metrics.ts` 模块级累计 `requestCount` / `cacheHits` / `retries` / `errors` / `durationMs`。`runCli` 在每次 handler 调用前 `resetMetrics()`，handler 返回后 `appendCommandMeta(result, snapshotMetrics())` 把这些字段写进 `result.meta`（normal 模式天然支持；compact / verbose 也带上，方便排查）。

例：跑同一个 GET 命令第二次，会看到 `meta.cacheHits=1`、`meta.requestCount=1`，第二次不发请求。

### 写保护（`UNSUPPORTED_WRITE_ACTIONS`）

`src/core/write-guard.ts` 维护一个 `UNSUPPORTED_WRITE_ACTIONS: Record<string, string>` 表，**先于** `--confirm` / 全局禁写检查生效。

- key 格式：`<commandName>[:<subKind>]`
- value：人类可读拒绝原因，Agent / 用户都能看懂
- 命中表 → 直接返回 `{ok: false, supported: false, error, action, diagnostic, payload}`，**不要求 confirm**，**不发请求**

当前填充：

| key | 原因 |
|---|---|
| `callRestApi:DELETE` | DELETE 操作不通过 CLI 暴露（高危：Confluence DELETE 多为不可逆）。请走 Confluence UI / 官方管理脚本 / 先 dry-run 列出受影响对象 |

维护约定：

1. 新增 command 时，如果动作不可逆 / 破坏性强 / 不该被 Agent 脚本化，加一行表
2. `rest.ts` 是唯一走 method-level 拦截的特例（`callRestApi:<METHOD>`）
3. 验证：`pnpm dev:writer <command> --...` 看返回 diagnostic；或 inline import `assertWriteAllowed` 测 throw

例：跑 `pnpm dev:writer callRestApi --method DELETE --path /content/{id} --pathParams '{"id":123}'` 会直接返回 `supported: false` 的 diagnostic，不发请求。

## 常用命令

- `pnpm install`
- `pnpm dev list`
- `pnpm dev:reader list`
- `pnpm dev:writer list`
- `pnpm dev searchContent --cql 'space = "DEV" AND text ~ "API"'`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm release:smoke-query --dry-run`

## 配置来源

凭证发现顺序：显式 `envFile`、环境变量、当前/父目录 `.env*`、Home `.env*`、MCP 配置。

支持变量：

- `CONFLUENCE_URL`
- `CONFLUENCE_API_BASE_URL`
- `CONFLUENCE_PAT` 或 `CONFLUENCE_PERSONAL_TOKEN`（Confluence 7.13.7 推荐，Bearer）
- `CONFLUENCE_USERNAME` + `CONFLUENCE_PASSWORD` 或 `CONFLUENCE_API_TOKEN`（Basic 兼容）
- `CONFLUENCE_DISABLE_WRITE=true` 可禁用所有真实写操作，即使传了 `confirm=true` 也只返回预览/诊断。

## Cloned Dependency Source

Read-only dependency source repositories are available under `.slim/clonedeps/repos/` for inspection. Do not edit these clones.

- `.slim/clonedeps/repos/pilat__markfluence/` — `pilat/markfluence` at `v0.3.1`; 用来借鉴其 Markdown AST 到 Confluence storage XHTML 的元素级转换设计。
