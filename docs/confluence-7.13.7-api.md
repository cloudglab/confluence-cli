# Confluence 7.13.7 REST API 与 PAT 稳定基线

本项目优先面向 Atlassian Confluence Server/Data Center 7.13.7。REST API 清单从官方文档提取：`https://docs.atlassian.com/ConfluenceServer/rest/7.13.7/`。

## Personal Access Token

Confluence 7.13.7 支持 Personal Access Token（PAT）。调用 REST API 时使用 Bearer 认证：

```http
Authorization: Bearer <personal-access-token>
```

CLI 优先读取：

- `CONFLUENCE_PAT`
- `CONFLUENCE_PERSONAL_TOKEN`

Basic Auth 仅作为兼容模式：

- `CONFLUENCE_USERNAME`
- `CONFLUENCE_PASSWORD` 或 `CONFLUENCE_API_TOKEN`

这些 REST API 都可以用 PAT Bearer 调用；实际是否成功取决于 PAT 所属用户权限、空间权限、全局权限和实例配置。

## 文档更新稳定链路

稳定更新页面不要直接盲写，必须走三步：

1. `GET /rest/api/content/{id}?expand=body.storage,version,space,ancestors` 读取当前版本。
2. 生成 Confluence `storage` 或 `wiki` body。
3. `PUT /rest/api/content/{contentId}` 写入，`version.number` 必须递增。

建议默认写 `body.storage`，`wiki` 仅作为兼容输入格式保留。

## 7.13.7 官方 REST API 全量端点

以下端点从官方 7.13.7 页面解析得到；页面中的示例路径 `PUT /rest/api/content/456` 已排除，保留模板端点 `PUT /rest/api/content/{contentId}`。

| 方法 | 端点 |
| --- | --- |
| `GET` | `/rest/api/accessmode` |
| `GET` | `/rest/api/audit` |
| `POST` | `/rest/api/audit` |
| `GET` | `/rest/api/audit/export` |
| `GET` | `/rest/api/audit/retention` |
| `PUT` | `/rest/api/audit/retention` |
| `GET` | `/rest/api/audit/since` |
| `GET` | `/rest/api/content` |
| `POST` | `/rest/api/content` |
| `GET` | `/rest/api/content/search` |
| `POST` | `/rest/api/content/blueprint/instance/{draftId}` |
| `PUT` | `/rest/api/content/blueprint/instance/{draftId}` |
| `PUT` | `/rest/api/content/{contentId}` |
| `GET` | `/rest/api/content/{id}` |
| `DELETE` | `/rest/api/content/{id}` |
| `GET` | `/rest/api/content/{id}/child` |
| `GET` | `/rest/api/content/{id}/child/attachment` |
| `POST` | `/rest/api/content/{id}/child/attachment` |
| `PUT` | `/rest/api/content/{id}/child/attachment/{attachmentId}` |
| `POST` | `/rest/api/content/{id}/child/attachment/{attachmentId}/data` |
| `GET` | `/rest/api/content/{id}/child/comment` |
| `GET` | `/rest/api/content/{id}/child/{type}` |
| `GET` | `/rest/api/content/{id}/descendant` |
| `GET` | `/rest/api/content/{id}/descendant/{type}` |
| `GET` | `/rest/api/content/{id}/history` |
| `GET` | `/rest/api/content/{id}/history/{version}/macro/hash/{hash}` |
| `GET` | `/rest/api/content/{id}/history/{version}/macro/id/{macroId}` |
| `GET` | `/rest/api/content/{id}/label` |
| `POST` | `/rest/api/content/{id}/label` |
| `DELETE` | `/rest/api/content/{id}/label` |
| `DELETE` | `/rest/api/content/{id}/label/{label}` |
| `GET` | `/rest/api/content/{id}/property` |
| `POST` | `/rest/api/content/{id}/property` |
| `POST` | `/rest/api/content/{id}/property/{key}` |
| `GET` | `/rest/api/content/{id}/property/{key}` |
| `PUT` | `/rest/api/content/{id}/property/{key}` |
| `DELETE` | `/rest/api/content/{id}/property/{key}` |
| `GET` | `/rest/api/content/{id}/restriction/byOperation` |
| `GET` | `/rest/api/content/{id}/restriction/byOperation/{operationKey}` |
| `POST` | `/rest/api/contentbody/convert/{to}` |
| `GET` | `/rest/api/group` |
| `GET` | `/rest/api/group/{groupName}` |
| `GET` | `/rest/api/group/{groupName}/member` |
| `GET` | `/rest/api/longtask` |
| `GET` | `/rest/api/longtask/{id}` |
| `GET` | `/rest/api/search` |
| `GET` | `/rest/api/space` |
| `POST` | `/rest/api/space` |
| `POST` | `/rest/api/space/_private` |
| `GET` | `/rest/api/space/{spaceKey}` |
| `PUT` | `/rest/api/space/{spaceKey}` |
| `DELETE` | `/rest/api/space/{spaceKey}` |
| `GET` | `/rest/api/space/{spaceKey}/content` |
| `GET` | `/rest/api/space/{spaceKey}/content/{type}` |
| `GET` | `/rest/api/space/{spaceKey}/property` |
| `POST` | `/rest/api/space/{spaceKey}/property` |
| `POST` | `/rest/api/space/{spaceKey}/property/{key}` |
| `GET` | `/rest/api/space/{spaceKey}/property/{key}` |
| `PUT` | `/rest/api/space/{spaceKey}/property/{key}` |
| `DELETE` | `/rest/api/space/{spaceKey}/property/{key}` |
| `GET` | `/rest/api/user` |
| `GET` | `/rest/api/user/anonymous` |
| `GET` | `/rest/api/user/current` |
| `GET` | `/rest/api/user/memberof` |
| `POST` | `/rest/api/user/watch/content/{contentId}` |
| `GET` | `/rest/api/user/watch/content/{contentId}` |
| `DELETE` | `/rest/api/user/watch/content/{contentId}` |
| `POST` | `/rest/api/user/watch/space/{spaceKey}` |
| `GET` | `/rest/api/user/watch/space/{spaceKey}` |
| `DELETE` | `/rest/api/user/watch/space/{spaceKey}` |
| `GET` | `/rest/api/webhooks` |
| `POST` | `/rest/api/webhooks` |
| `GET` | `/rest/api/webhooks/{webhookId}` |
| `PUT` | `/rest/api/webhooks/{webhookId}` |
| `DELETE` | `/rest/api/webhooks/{webhookId}` |
| `GET` | `/rest/api/webhooks/{webhookId}/latest` |
| `GET` | `/rest/api/webhooks/{webhookId}/statistics` |
| `GET` | `/rest/api/webhooks/{webhookId}/statistics/summary` |
| `POST` | `/rest/api/webhooks/test` |

## 稳定 CLI 优先实现范围

第一阶段只实现与文档维护直接相关的接口：

- 内容读取、搜索、创建、更新、删除。
- 子页面、附件、标签、内容属性。
- 空间读取与空间内容查询。
- `GET /rest/api/user/current` 用于 token 校验。
- `POST /rest/api/contentbody/convert/{to}` 用于服务端 body 转换。

审计、用户 watch、webhooks、longtask、group 等接口先作为已知开放能力记录，不默认纳入文档上传主链路。

## 与 confluence-skill 能力对应关系

以下只列 `confluence-skill` 中已有明确能力能对应上的 REST API：

| confluence-skill 能力 | 对应 REST API |
| --- | --- |
| `confluence_search` / CQL 搜索 | `GET /rest/api/content/search`, `GET /rest/api/search` |
| `confluence_get_page` | `GET /rest/api/content/{id}`, `GET /rest/api/content` |
| `confluence_create_page` | `POST /rest/api/content` |
| `confluence_update_page` | `PUT /rest/api/content/{contentId}` |
| `confluence_delete_page` | `DELETE /rest/api/content/{id}` |
| `confluence_get_page_children` | `GET /rest/api/content/{id}/child`, `GET /rest/api/content/{id}/child/{type}` |
| `confluence_get_comments` | `GET /rest/api/content/{id}/child/comment` |
| `confluence_add_comment` | `POST /rest/api/content` |
| `confluence_get_labels` | `GET /rest/api/content/{id}/label` |
| `confluence_add_label` | `POST /rest/api/content/{id}/label` |
| 页面图片和附件处理 | `GET /rest/api/content/{id}/child/attachment`, `POST /rest/api/content/{id}/child/attachment`, `PUT /rest/api/content/{id}/child/attachment/{attachmentId}`, `POST /rest/api/content/{id}/child/attachment/{attachmentId}/data` |
| Markdown 上传页面 | `POST /rest/api/content`, `PUT /rest/api/content/{contentId}`, `POST /rest/api/content/{id}/child/attachment` |
| 下载页面到 Markdown | `GET /rest/api/content/{id}`, `GET /rest/api/content/{id}/child/attachment`, `GET /rest/api/content/{id}/child/{type}` |
| mark metadata 中的空间和标签 | `GET /rest/api/space`, `GET /rest/api/space/{spaceKey}`, `GET /rest/api/content/{id}/label`, `POST /rest/api/content/{id}/label` |

## 已转换为 TS CLI 的语义化命令

当前 CLI 不只保留 `callRestApi` 通用调用，也把 MCP/Python 常用能力转换成稳定命令：

| 能力 | TS CLI 命令 |
| --- | --- |
| 搜索内容 | `searchContent` |
| 读取内容 | `getContent`, `findContent` |
| 创建/更新 Markdown 页面 | `uploadMarkdown` |
| 删除内容 | `deleteContent` |
| 读取子页 | `getPageChildren` |
| 评论 | `getComments`, `addComment` |
| 标签 | `getLabels`, `addLabels`, `deleteLabel` |
| 附件 | `listAttachments`, `uploadAttachment`, `updateAttachment`, `downloadAttachment` |
| 下载页面 | `downloadPage`，支持 `downloadAttachments` 和 `downloadChildren` |
| 空间与用户校验 | `listSpaces`, `getSpace`, `getCurrentUser` |
| body 转换 | `convertContentBody` |
| mark metadata | `generateMarkMetadata` |

## 当前 skill 常见问题与 CLI 约束

通用 Confluence skill 经常更新失败，通常不是搜索问题，而是写入链路不稳定：

- Cloud 与 Server/Data Center 认证混用：7.13.7 PAT 应使用 Bearer，不是 Cloud Basic API Token。
- 未先读取当前 `version.number`，直接 PUT 导致版本冲突。
- Markdown 直接转 HTML 不等于 Confluence storage，复杂宏、附件、图片容易丢。
- 未明确 parent/ancestor，更新时可能移动页面或创建到错误位置。
- 未区分正文、附件、标签、属性，导致“一次上传”行为不可预测。

CLI 稳定版应坚持：认证固定、端点固定、写入前读取、写入需要确认、复杂能力分阶段实现。
