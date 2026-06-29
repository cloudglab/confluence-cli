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
confluence callRestApi --method PUT --path '/content/{contentId}' --pathParams '{"contentId":"123456"}' --body '{"id":"123456","type":"page","title":"Demo","version":{"number":7},"body":{"storage":{"value":"<p>Hello</p>","representation":"storage"}}}' --confirm true
```

写 REST 端点仍受 `--confirm true` 和 `CONFLUENCE_DISABLE_WRITE=true` 保护。

说明：

- `--pathParams` / `--query` / `--body` 传 JSON 时，直接传合法 JSON 字符串即可。
- `callRestApi` 只接受 `listRestApis` 列出来的官方端点模板，`path` 需要保持模板形式，例如 `'/content/{contentId}'`。
- 如果只是改页面正文，优先用高层命令 `updateContentStorage`，不用自己处理版本号。
