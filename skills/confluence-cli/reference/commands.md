# 命令速查

## 基础

```bash
confluence help
confluence list
confluence version
confluence help searchContent
```

## 配置

```bash
confluence initConfluence --url https://confluence.example.com --pat TOKEN --save true
```

## 查询

```bash
confluence searchContent --cql 'space = "DEV" AND text ~ "API"'
confluence getContent --id 123456
confluence findContent --space DEV --title "API Guide"
confluence getPageChildren --id 123456 --type page
```

## 发布与下载

```bash
confluence uploadMarkdown --file docs/page.md --space DEV --toc --confirm false
confluence uploadMarkdown --file docs/page.md --id 123456 --attachments '["docs/a.png"]' --toc --confirm true
confluence uploadHtml --file docs/page.html --space DEV --toc --confirm true
confluence downloadPage --id 123456 --outputDir exports --downloadAttachments true --downloadChildren true
```

## REST 透传

```bash
confluence listRestApis --group content --limit 20
confluence callRestApi --method GET --path '/content/{id}' --pathParams '{"id":"123456"}' --query '{"expand":"body.storage,version"}'
```
