# 内容操作

## 查询页面

```bash
confluence searchContent --cql 'type = page AND title ~ "Runbook"'
confluence findContent --space DEV --title "Runbook"
confluence getContent --id 123456
```

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
