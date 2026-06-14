# REST 透传

`listRestApis` 和 `callRestApi` 用于覆盖 Confluence 7.13.7 官方 REST 端点。

## 查看端点

```bash
confluence listRestApis --limit 20
confluence listRestApis --group content --limit 20
confluence listRestApis --method GET --write false --limit 20
```

## 调用端点

```bash
confluence callRestApi --method GET --path '/content/{id}' --pathParams '{"id":"123456"}' --query '{"expand":"body.storage,version"}'
```

写 REST 端点仍受 `--confirm true` 和 `CONFLUENCE_DISABLE_WRITE=true` 保护。
