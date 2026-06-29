export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  initConfluence: "初始化或校验 Confluence 连接配置",
  install: "安装 CLI 和 Confluence skill",
  update: "更新 CLI 和 Confluence skill",
  convertMarkdownToWiki: "将 Markdown 转换为 Confluence Wiki 标记",
  convertMermaidToDrawio: "将 Mermaid 图转换为 draw.io XML",
  generateMarkMetadata: "生成 Markdown 页面元数据",
  urlParse: "解析 Confluence 网页 URL 为结构化意图",
  listRestApis: "列出 Confluence 7.13.7 官方 REST 端点模板",
  callRestApi: "按官方端点模板调用原始 Confluence REST 请求",
  listSpaces: "列出 Confluence 空间",
  getSpace: "获取空间详情",
  getCurrentUser: "输出当前账号原始资料",
  whoami: "查看当前 Confluence 账号",
  "who-am-i": "whoami 的别名",
  configShow: "显示当前配置来源与脱敏凭证",
  searchContent: "使用 CQL 搜索内容",
  getContent: "获取页面或博客内容",
  updateContentStorage: "按 storage HTML 更新页面正文并自动处理版本号",
  getPageSnapshot: "单次拿到页面快照(focus + body 预览 + labels + comments + attachments + 子页)",
  deleteContent: "删除 Confluence 内容",
  addLabels: "添加内容标签",
  deleteLabel: "移除内容标签",
  getLabels: "列出内容标签",
  listAttachments: "列出页面附件",
  uploadAttachment: "上传页面附件",
  downloadAttachment: "下载页面附件",
  uploadMarkdown: "上传 Markdown 为 Confluence storage 页面",
  downloadPage: "下载页面为本地内容",
};

export function describeCommandReason(commandName: string): string {
  return COMMAND_DESCRIPTIONS[commandName] ?? `查看命令 ${commandName} 的输出`; 
}
