# CLI

## 安装与更新

```bash
confluence install --skip-config-check true
confluence update --skip-config-check true
```

可选参数：

- `--skill-source local|git|npm`
- `--skill-local-path <dir>`
- `--cli-only true|false`
- `--skill-only true|false`
- `--skip-config-check true|false`

## 角色入口

```bash
confluence list
confluence-reader list
confluence-writer list
```

- `confluence`：完整入口。
- `confluence-reader`：不注册发布上传类 transfer 命令。
- `confluence-writer`：注册写入和发布命令，但仍需要 `--confirm true`。

## 环境变量

- `CONFLUENCE_URL`
- `CONFLUENCE_PAT` 或 `CONFLUENCE_PERSONAL_TOKEN`
- `CONFLUENCE_USERNAME` + `CONFLUENCE_PASSWORD`
- `CONFLUENCE_DISABLE_WRITE=true`
- `CONFLUENCE_SKIP_UPDATE_CHECK=true`
