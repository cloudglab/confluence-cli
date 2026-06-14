# Release

## 发布前检查

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm release:smoke-query --dry-run
```

如需连接真实 Confluence 做 smoke 查询，先设置：

```bash
CONFLUENCE_SMOKE_CONTENT_ID=123456
CONFLUENCE_SMOKE_SPACE=DEV
CONFLUENCE_SMOKE_TITLE="API Guide"
```

## 发布流程

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/publish.yml` 会校验 tag 版本与 `package.json` 一致，然后执行：

- `pnpm install --frozen-lockfile`
- `pnpm check`
- `npm publish --provenance --access public`

## 安全约定

- 真实写操作必须显式传 `--confirm true`
- `CONFLUENCE_DISABLE_WRITE=true` 可全局禁用真实写操作
- 发布前优先跑 `pnpm release:smoke-query --dry-run`

## 文档发布

`docs/index.html` 由 `.github/workflows/pages.yml` 发布到 GitHub Pages。更新 README、skill reference 或 release 文档后，可先本地打开 `docs/index.html` 检查命令速查页。
