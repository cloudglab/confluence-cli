# 全量命令速查

> 兜底文档。CLI 注册的全部命令在此处都有名字 + 简要说明。
> 写操作示例和参数细节见对应场景文档（`content.md` / `transfer.md` / ...）。

## 入口与基础

| 命令 | 简介 |
| --- | --- |
| `initConfluence` | 初始化或校验 Confluence 连接配置 |
| `whoami` | 查看当前 Confluence 账号 |
| `who-am-i` | whoami 的别名 |
| `getCurrentUser` | 输出当前账号原始资料 |

## 空间 Space

| 命令 | 简介 |
| --- | --- |
| `listSpaces` | 列出 Confluence 空间 |
| `getSpace` | 获取空间详情 |
| `convertContentBody` | 在 storage / view / export_view / styled_view 之间转换 |

## 内容 Content

| 命令 | 简介 |
| --- | --- |
| `searchContent` | 使用 CQL 搜索内容 |
| `getContent` | 获取页面或博客内容 |
| `getPageSnapshot` | 单次拿到页面快照（focus + body 预览 + labels + comments + attachments + 子页） |
| `findContent` | 按标题 / 空间 / 类型查找内容 |
| `deleteContent` | 删除 Confluence 内容（需 confirm） |
| `getPageChildren` | 列出页面的子页 / 附件 |
| `getComments` | 获取页面评论 |
| `addComment` | 添加页面评论（需 confirm；支持 inline） |
| `report` | 按时间窗口生成内容报表 |

## 标签 Labels

| 命令 | 简介 |
| --- | --- |
| `getLabels` | 获取页面的标签列表 |
| `addLabels` | 给页面追加标签（需 confirm） |
| `deleteLabel` | 删除页面的某个标签（需 confirm） |

## 附件 Attachments

| 命令 | 简介 |
| --- | --- |
| `listAttachments` | 列出页面附件 |
| `uploadAttachment` | 上传页面附件（需 confirm） |
| `updateAttachment` | 更新附件内容（需 confirm） |
| `downloadAttachment` | 下载附件到本地 |

## 发布与下载 Transfer

| 命令 | 简介 |
| --- | --- |
| `uploadMarkdown` | 上传 Markdown 为 Confluence storage 页面（需 confirm） |
| `uploadHtml` | 上传 HTML 为 Confluence storage 页面（需 confirm） |
| `downloadPage` | 下载页面为本地 Markdown，可选下载附件 / 子页 |

## 转换 Convert

| 命令 | 简介 |
| --- | --- |
| `convertMarkdownToWiki` | 将 Markdown 转换为 Confluence Wiki Markup |
| `convertMermaidToDrawio` | 将 Mermaid 图转换为 draw.io .drawio 文件 |

## 元数据 Metadata

| 命令 | 简介 |
| --- | --- |
| `generateMarkMetadata` | 生成 Markdown 页面元数据（mark 兼容） |
| `urlParse` | 解析 Confluence 网页 URL 为结构化意图 |

## 底层 REST

| 命令 | 简介 |
| --- | --- |
| `listRestApis` | 列出 Confluence 7.13.7 REST 端点模板 |
| `callRestApi` | 调用任意 Confluence 7.13.7 REST 端点（写操作需 confirm） |

## 安装 / 更新 / 卸载

| 命令 | 简介 |
| --- | --- |
| `install` | 安装 CLI + Confluence skill |
| `update` | 更新 CLI + Confluence skill |
| `upgrade` | update 的别名 |
| `uninstall` | 卸载 CLI / skill / 配置 |
| `remove` | uninstall 的别名 |

## 内置命令

| 命令 | 简介 |
| --- | --- |
| `help` | 查看总帮助或指定命令参数 |
| `list` | 按场景列出可用命令 |
| `version` | 查看 CLI 版本 |
| `changelog` | 查看版本更新记录 |