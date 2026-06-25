# 场景化组合

典型用户意图 → 命令组合示例。所有写操作必须传 `--confirm true`。

## 1. 查一个页面（拿到正文 + 子页 + 评论 + 标签）

```bash
confluence getContent --id 123456 --expand body.storage,version,metadata.labels
confluence getComments --id 123456
confluence getLabels --id 123456
confluence getPageChildren --id 123456 --type page
```

## 2. 一次拿到页面全貌

```bash
confluence getPageSnapshot --id 123456
# 默认:bodyPreviewChars=1500 / commentLimit=5 / attachmentLimit=10 / childLimit=10
# 也可以显式覆盖:confluence getPageSnapshot --id 123456 --bodyPreviewChars 4000
```

## 3. 按标题 / 空间找页面

```bash
confluence findContent --space DEV --title "API Guide"
confluence searchContent --cql 'type = page AND title ~ "Runbook"'
confluence searchContent --cql 'space = "DEV" AND text ~ "API"' --limit 10
```

## 4. 按时间窗口生成内容报表

```bash
confluence report --period day
confluence report --period week --space DEV
confluence report --period custom --from 2026-05-01 --to 2026-05-31
```

## 5. URL → 命令

| URL 形态 | 命令 |
| --- | --- |
| `https://cf.example.com/pages/viewpage.action?pageId=12345` | `confluence getContent --id 12345` |
| `https://cf.example.com/wiki/spaces/DEV/pages/12345/Title` | `confluence getContent --id 12345` |
| `https://cf.example.com/spaces/DEV/overview` | `confluence getSpace --spaceKey DEV` |
| `https://cf.example.com/search?queryString=runbook` | `confluence searchContent --cql 'text ~ "runbook"'` |

任何 URL 都先用 `confluence urlParse --url <url>` 解析。

## 6. Markdown 发布

```bash
# dry-run
confluence uploadMarkdown --file docs/page.md --space DEV --toc
# 创建
confluence uploadMarkdown --file docs/page.md --space DEV --toc --confirm true
# 更新
confluence uploadMarkdown --file docs/page.md --id 123456 --toc --confirm true
# 带附件 + Mermaid
confluence uploadMarkdown --file docs/page.md --space DEV --attachments '["a.png"]' --toc --confirm true
# 不渲染 Mermaid
confluence uploadMarkdown --file docs/page.md --id 123456 --mermaid none --toc --confirm true
```

## 7. HTML 发布

```bash
confluence uploadHtml --file page.html --space DEV --toc --confirm true
confluence uploadHtml --file page.html --id 123456 --toc --confirm true
```

## 8. 下载页面（带附件和子页）

```bash
confluence downloadPage --id 123456 --outputDir exports
confluence downloadPage --id 123456 --outputDir exports --downloadAttachments true --downloadChildren true --saveHtml true
```

## 9. 评论与标签

```bash
confluence addComment --id 123456 --body "LGTM" --confirm true
# 内联评论
confluence addComment --id 123456 --body "TODO" --inline "selected text on page" --confirm true
confluence addLabels --id 123456 --labels '["api","docs"]' --confirm true
confluence deleteLabel --id 123456 --label api --confirm true
```

## 10. 附件

```bash
confluence listAttachments --id 123456
confluence uploadAttachment --id 123456 --file ./a.png --confirm true
confluence downloadAttachment --id 123456 --title "a.png" --outputDir ./out
```

## 11. REST 透传

```bash
confluence listRestApis --group content --limit 20
confluence callRestApi --method GET --path '/content/{id}' --pathParams '{"id":"123456"}' --query '{"expand":"body.storage,version"}'
```

## 12. 排查问题

```bash
confluence help <command>            # 校对参数名
confluence list                      # 列全部命令
confluence version                   # CLI 版本
confluence whoami                    # 当前登录账号
confluence urlParse --url <URL>      # URL 解析
confluence changelog                 # 最近更新
```