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
confluence config show
```

## 查询

```bash
confluence searchContent --cql 'space = "DEV" AND text ~ "API"'
confluence getContent --id 123456 --expand 'body.storage,version'
confluence findContent --space DEV --title "API Guide"
confluence getPageChildren --id 123456 --type page
confluence updateContentStorage --id 123456 --file ./page.storage.html --confirm true
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
confluence callRestApi --method PUT --path '/content/{contentId}' --pathParams '{"contentId":"123456"}' --body '{"id":"123456","type":"page","title":"Demo","version":{"number":7},"body":{"storage":{"value":"<p>Hello</p>","representation":"storage"}}}' --confirm true
```
