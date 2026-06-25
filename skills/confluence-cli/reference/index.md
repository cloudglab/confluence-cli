# Reference 索引

按场景分类的二级文档。SKILL.md 主入口保持精简，本目录覆盖 CLI 注册的全部命令。

## 主链路（高频 / 日常）

| 文档 | 场景 | 关键命令 |
| --- | --- | --- |
| [cli.md](./cli.md) | CLI 基础与配置 | `help`, `list`, `version`, `whoami`, `initConfluence` |
| [commands.md](./commands.md) | 常用命令速查 | `searchContent`, `getContent`, `findContent` |
| [content.md](./content.md) | 内容查询 / 评论 / 标签 | `getContent`, `getComments`, `addComment`, `getLabels` |
| [transfer.md](./transfer.md) | 发布与下载 | `uploadMarkdown`, `uploadHtml`, `downloadPage` |
| [rest.md](./rest.md) | REST 透传 | `listRestApis`, `callRestApi` |
| [overview.md](./overview.md) | 总览与工作流 | — |

## 兜底

| 文档 | 作用 |
| --- | --- |
| [cheatsheet.md](./cheatsheet.md) | 全量命令速查（一行一条） |
| [scenarios.md](./scenarios.md) | 场景化组合（典型链路） |

## 验证

跑下面命令验证 reference 覆盖 vs CLI 注册：

```bash
pnpm coverage
# 等价于 node scripts/check-coverage.mjs
```

应当看到 `未覆盖命令数: 0`。

可选参数：`--json` / `--missing`。