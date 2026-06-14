# confluence-cli

面向 Agent 和本地自动化的 Confluence REST CLI。整体结构参考 `zentao-cli`：命令注册表、工具分层、REST API 封装、结果统一为 JSON content。

## 开发约定

- README 面向用户，AGENTS 放实现细节。
- 真实写操作必须显式传 `confirm=true`；没有确认时只返回预览或 dry-run 信息。
- 不要提交代码，除非用户明确要求。
- 优先运行轻量验证：`pnpm typecheck`、`pnpm build`。

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
