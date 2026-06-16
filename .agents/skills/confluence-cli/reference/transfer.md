# 发布与下载

## Markdown 发布

```bash
confluence uploadMarkdown --file docs/page.md --space DEV --toc --confirm false
confluence uploadMarkdown --file docs/page.md --id 123456 --toc --confirm true
```

## HTML 发布

```bash
confluence uploadHtml --file docs/page.html --space DEV --toc --confirm false
confluence uploadHtml --file docs/page.html --id 123456 --toc --confirm true
```

## Mermaid 与附件

- 默认将 Markdown/HTML 中的 Mermaid 渲染为 PNG 附件并插入图片宏。
- 如需保留原代码块，使用 `--mermaid none`。
- 附件用 JSON 数组传入：`--attachments '["docs/a.png"]'`。

## 下载

```bash
confluence downloadPage --id 123456 --outputDir exports --downloadAttachments true --downloadChildren true
```
