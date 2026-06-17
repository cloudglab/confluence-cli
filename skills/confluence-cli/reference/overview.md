# 总览

## 这个 skill 做什么

- 用命令行方式操作 Confluence Server/Data Center REST API。
- 默认写操作只 preview，真实写入必须显式 `--confirm true`。
- 支持页面搜索、读取、评论、标签、附件、Markdown/HTML 发布、页面下载和 REST 端点透传。

## 推荐工作流

1. 先确认本机是否安装 `confluence`。
2. 如果没有，优先运行 `confluence install --skip-config-check true`。
3. 对命令参数不确定时，先运行 `confluence help <command>` 校对。
4. 查询类任务优先用 `searchContent`、`getContent`、`findContent`。
5. 发布类任务优先 dry-run，再加 `--confirm true`。
6. Markdown/HTML 全量发布默认加 `--toc`，除非用户明确不要目录。
7. 自动化环境可设置 `CONFLUENCE_DISABLE_WRITE=true` 彻底禁用真实写入。

## 适合谁

- 需要命令行操作 Confluence 的人。
- 需要把 Confluence 接入智能体的人。
- 需要在 Confluence 7.13.7 环境下稳定自动化的人。
