---
name: confluence-cli
description: Use this CLI for Confluence REST operations from a terminal or agent workflow. Triggers on Confluence page search, read, upload (Markdown/HTML with Mermaid + TOC), download, labels, attachments, comments, and Confluence 7.13.7 REST pass-through.
triggers:
  - confluence
  - confluence-cli
  - wiki
  - Wiki
  - 页面
  - 空间
  - CQL
  - space
  - page
argument-hint: "[command]"
---

# Confluence CLI Skill

Use this CLI when a task needs Confluence REST operations from a terminal or agent workflow.

Start with these references when you need details:

- `reference/overview.md`：整体工作流与安全原则
- `reference/commands.md`：命令速查
- `reference/cli.md`：安装、更新、角色入口和环境变量
- `reference/content.md`：页面查询、读取、子页、评论、标签
- `reference/transfer.md`：Markdown/HTML 发布、下载、附件、Mermaid/TOC
- `reference/rest.md`：Confluence 7.13.7 REST 端点透传
- `../../docs/release.md`：发布前检查与 npm 发布流程

## Decision Matrix

- Read/search small content: `confluence searchContent` or `confluence getContent`.
- Convert Markdown locally: `confluence convertMarkdownToWiki`.
- Generate mark metadata: `confluence generateMarkMetadata`.
- Upload large Markdown through REST: `confluence uploadMarkdown --toc --confirm true`.
- Upload raw HTML through REST: `confluence uploadHtml --toc --confirm true`.
- For full page publishes or republish flows, include `--toc` by default; only omit it when the user explicitly says no TOC.
- Upload Markdown with attachments: `confluence uploadMarkdown --attachments '["a.png"]' --toc --confirm true`.
- Dry-run uploads first: omit `--confirm true`.
- Render Mermaid on the fly: any ```mermaid fence in Markdown/HTML auto-generates PNG attachments by default.
- Download editable backup: `confluence downloadPage`.
- Download page with attachments/children: `confluence downloadPage --downloadAttachments true --downloadChildren true`.
- Use MCP-style page tools: `getPageChildren`, `getComments`, `addComment`, `getLabels`, `addLabels`.
- Use attachment tools: `listAttachments`, `uploadAttachment`, `updateAttachment`, `downloadAttachment`.
- Check PAT identity: `confluence getCurrentUser`.

## Safety

All writes must pass `--confirm true`. Without confirmation, upload, delete, label, comment and attachment write commands return a dry-run preview.

## CQL Examples

```bash
confluence searchContent --cql 'space = "DEV" AND text ~ "API"'
confluence searchContent --cql 'type = page AND title ~ "Runbook"'
```

## Upload Patterns

```bash
# Markdown → Confluence，自动 Mermaid → PNG 附件图片，默认注入双 TOC 宏
confluence uploadMarkdown --file doc.md --id 142552620 --toc --tocMaxLevel 3 --confirm true

# 保持原代码块不渲染
confluence uploadMarkdown --file doc.md --id 142552620 --mermaid none --toc --confirm true

# HTML → Confluence，同样支持Mermaid和TOC
confluence uploadHtml --file page.html --space DEV --toc --confirm true

# 只预览（dry-run）
confluence uploadMarkdown --file doc.md --id 142552620 --toc
confluence uploadHtml --file page.html --space DEV --toc
```
