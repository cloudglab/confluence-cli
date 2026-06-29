# 内容操作

## 查询页面

```bash
confluence searchContent --cql 'type = page AND title ~ "Runbook"'
confluence findContent --space DEV --title "Runbook"
confluence getContent --id 123456
confluence getContent --id 123456 --expand 'body.storage,version'
confluence updateContentStorage --id 123456 --file ./page.storage.html --confirm true
```

说明：

- 读页面正文时，优先显式传 `--expand 'body.storage,version'`，这样能直接拿到 `storage` 正文和当前版本号。
- 改写页面正文时，优先用 `updateContentStorage`，CLI 会自动执行“读取最新版本 -> version + 1 -> PUT”，并在版本冲突时自动重试一次。

## 子页、评论、标签

```bash
confluence getPageChildren --id 123456 --type page
confluence getComments --id 123456
confluence addComment --id 123456 --text "LGTM" --confirm true
confluence getLabels --id 123456
confluence addLabels --id 123456 --labels '["api","docs"]' --confirm true
```

## 安全原则

所有删除、评论、标签等写命令都必须显式 `--confirm true`；不传确认时只返回 preview。
