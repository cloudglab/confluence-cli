import type { CliRegistry, CommandMetadata } from "./cli-registry.js";
import { hasToolGroup } from "./roles.js";
import type { Role } from "../types/common.js";
import { registerAttachmentTools } from "../tools/attachments.js";
import { registerConvertTools } from "../tools/convert.js";
import { registerContentTools } from "../tools/content.js";
import { registerInitTools } from "../tools/init.js";
import { registerInstallTools } from "../tools/install.js";
import { registerLabelTools } from "../tools/labels.js";
import { registerMetadataTools } from "../tools/metadata.js";
import { registerRestTools } from "../tools/rest.js";
import { registerSpaceTools } from "../tools/spaces.js";
import { registerTransferTools } from "../tools/transfer.js";

export interface RegisterToolsOptions {
  commandName?: string;
  onGroupRegister?: (group: ReturnType<typeof getToolGroupNames>[number], commands: string[]) => void;
}

type GroupLoader = () => (registry: CliRegistry) => void;

const groupLoaders: Record<ReturnType<typeof getToolGroupNames>[number], GroupLoader> = {
  init: () => registerInitTools,
  install: () => registerInstallTools,
  convert: () => registerConvertTools,
  metadata: () => registerMetadataTools,
  rest: () => registerRestTools,
  space: () => registerSpaceTools,
  content: () => registerContentTools,
  labels: () => registerLabelTools,
  attachments: () => registerAttachmentTools,
  transfer: () => registerTransferTools,
};

/**
 * 命令级元数据,集中维护,避免污染 10 个 tools 文件。
 * 仅 Agent 关心的"高价值命令"先填;其它命令不填时,help 也不会渲染 Cost / Next 段。
 */
const COMMAND_METADATA: Record<string, CommandMetadata> = {
  // init / 元信息
  whoami: { costHint: "1 REST 请求", nextBestTools: ["initConfluence", "searchContent"] },
  configShow: { costHint: "0-1 次本地配置读取", nextBestTools: ["whoami", "initConfluence"] },
  initConfluence: { costHint: "0-1 REST 请求(校验连接)", nextBestTools: ["whoami", "searchContent"] },

  // space
  listSpaces: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["getSpace", "searchContent"],
    recommendations: [
      { tool: "getSpace", reason: "继续读取某个空间的详情", priority: 0, args: { spaceKey: { source: "payload", path: "items.0.key" } } },
      { tool: "searchContent", reason: "在空间范围内继续搜页面", priority: -1 },
    ],
  },
  getSpace: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["listSpaces", "searchContent"],
    recommendations: [
      { tool: "searchContent", reason: "按当前空间继续搜索内容", priority: 0 },
      { tool: "listSpaces", reason: "回到空间列表继续挑选", priority: -1 },
    ],
  },

  // content
  searchContent: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["findContent", "getContent", "report"],
    recommendations: [
      { tool: "findContent", reason: "按标题或空间缩小命中范围", priority: 0 },
      { tool: "getContent", reason: "读取某个命中页面的正文", priority: 0 },
      { tool: "report", reason: "切到日报/周报视角继续筛选", priority: -1 },
    ],
  },
  getContent: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["getPageChildren", "addLabels", "downloadPage", "updateContentStorage"],
    recommendations: [
      { tool: "getPageChildren", reason: "继续查看当前页面的子页结构", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "addLabels", reason: "给当前页面补标签", priority: -1, args: { id: { source: "input", path: "id" } } },
      { tool: "downloadPage", reason: "把当前页面下载到本地", priority: -1, args: { id: { source: "input", path: "id" } } },
      { tool: "updateContentStorage", reason: "按 storage HTML 回写当前页面正文", priority: -1, args: { id: { source: "input", path: "id" } } },
    ],
  },
  getPageSnapshot: {
    costHint: "5 REST 请求并行(15s 缓存, 重复调用几乎免费)",
    nextBestTools: ["getContent", "getLabels", "getComments", "listAttachments", "getPageChildren"],
    recommendations: [
      { tool: "getContent", reason: "查看当前页面完整正文", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "getLabels", reason: "单独查看当前页面标签", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "getComments", reason: "单独查看当前页面评论", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "listAttachments", reason: "单独查看当前页面附件", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "getPageChildren", reason: "单独查看当前页面子页", priority: 0, args: { id: { source: "input", path: "id" } } },
    ],
  },
  findContent: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["getContent", "searchContent"],
    recommendations: [
      { tool: "getContent", reason: "读取找到的目标页面正文", priority: 0, args: { id: { source: "payload", path: "items.0.id" } } },
      { tool: "searchContent", reason: "改用 CQL 做更细粒度检索", priority: -1 },
    ],
  },
  report: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["searchContent", "getContent"],
    recommendations: [
      { tool: "getContent", reason: "读取报表里某条内容的正文", priority: 0, args: { id: { source: "payload", path: "items.0.id" } } },
      { tool: "searchContent", reason: "改用原始 CQL 继续深挖", priority: -1 },
    ],
  },
  getPageChildren: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["getContent", "searchContent"],
    recommendations: [
      { tool: "getContent", reason: "读取当前页或某个子页正文", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "searchContent", reason: "切回搜索扩大范围", priority: -1 },
    ],
  },
  getComments: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["getContent"],
    recommendations: [
      { tool: "getContent", reason: "回看评论所属页面正文", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "addComment", reason: "继续给当前页面补充评论", priority: -1, args: { id: { source: "input", path: "id" } } },
    ],
  },
  addComment: {
    costHint: "1 REST 请求,需要 --confirm true",
    nextBestTools: ["getComments", "getContent"],
    recommendations: [
      { tool: "getComments", reason: "刷新当前页面评论列表", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "getContent", reason: "回看当前页面正文", priority: 0, args: { id: { source: "input", path: "id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  deleteContent: { costHint: "1 REST 请求,需要 --confirm true", cacheable: false, idempotent: false },
  updateContentStorage: {
    costHint: "2-4 REST 请求(先取最新版本再写入,冲突时最多重试一次),需要 --confirm true",
    nextBestTools: ["getContent", "downloadPage"],
    recommendations: [
      { tool: "getContent", reason: "回读刚更新的页面正文", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "downloadPage", reason: "把刚更新的页面下载到本地核对", priority: 0, args: { id: { source: "input", path: "id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },

  // labels
  addLabels: {
    costHint: "1 REST 请求,需要 --confirm true",
    nextBestTools: ["getLabels", "getContent"],
    recommendations: [
      { tool: "getLabels", reason: "刷新当前页面标签列表", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "getContent", reason: "回看当前页面正文", priority: 0, args: { id: { source: "input", path: "id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  deleteLabel: {
    costHint: "1 REST 请求,需要 --confirm true",
    recommendations: [
      { tool: "getLabels", reason: "刷新当前页面标签列表", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "getContent", reason: "回看当前页面正文", priority: 0, args: { id: { source: "input", path: "id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  getLabels: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["addLabels", "deleteLabel", "getContent"],
    recommendations: [
      { tool: "addLabels", reason: "继续给当前页面补标签", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "deleteLabel", reason: "移除当前页面上的某个标签", priority: -1, args: { id: { source: "input", path: "id" } } },
      { tool: "getContent", reason: "回看当前页面正文", priority: -1, args: { id: { source: "input", path: "id" } } },
    ],
  },

  // attachments
  listAttachments: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["downloadAttachment", "uploadAttachment"],
    recommendations: [
      { tool: "downloadAttachment", reason: "下载当前页某个附件", priority: 0, args: { id: { source: "input", path: "id" }, attachmentId: { source: "payload", path: "results.0.id" } } },
      { tool: "uploadAttachment", reason: "继续向当前页上传附件", priority: -1, args: { id: { source: "input", path: "id" } } },
    ],
  },
  uploadAttachment: {
    costHint: "1 REST 请求,需要 --confirm true",
    nextBestTools: ["listAttachments"],
    recommendations: [
      { tool: "listAttachments", reason: "刷新当前页面附件列表", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "downloadAttachment", reason: "下载刚上传的附件核对", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "getContent", reason: "回看附件所属页面正文", priority: -1, args: { id: { source: "input", path: "id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  updateAttachment: {
    costHint: "1 REST 请求,需要 --confirm true",
    recommendations: [
      { tool: "listAttachments", reason: "刷新当前页面附件列表", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "downloadAttachment", reason: "下载刚更新的附件核对", priority: 0, args: { id: { source: "input", path: "id" }, attachmentId: { source: "input", path: "attachmentId" } } },
      { tool: "getContent", reason: "回看附件所属页面正文", priority: -1, args: { id: { source: "input", path: "id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  downloadAttachment: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["listAttachments"] },

  // transfer
  uploadMarkdown: {
    costHint: "1-3 REST 请求(上传/转换/确认),需要 --confirm true",
    nextBestTools: ["downloadPage", "getContent"],
    recommendations: [
      { tool: "getContent", reason: "回读刚上传/更新的页面正文", priority: 1, args: { id: { source: "payload", path: "page.id" } } },
      { tool: "downloadPage", reason: "把刚上传的页面下载到本地核对", priority: 0, args: { id: { source: "payload", path: "page.id" } } },
      { tool: "listAttachments", reason: "查看本次上传后页面上的附件", priority: 0, args: { id: { source: "payload", path: "page.id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  uploadHtml: {
    costHint: "1-3 REST 请求(上传/转换/确认),需要 --confirm true",
    nextBestTools: ["getContent", "downloadPage"],
    recommendations: [
      { tool: "getContent", reason: "回读刚上传/更新的页面正文", priority: 1, args: { id: { source: "payload", path: "page.id" } } },
      { tool: "downloadPage", reason: "把刚上传的页面下载到本地核对", priority: 0, args: { id: { source: "payload", path: "page.id" } } },
      { tool: "listAttachments", reason: "查看本次上传后页面上的附件", priority: 0, args: { id: { source: "payload", path: "page.id" } } },
    ],
    cacheable: false,
    idempotent: false,
  },
  downloadPage: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["getContent", "uploadMarkdown"],
    recommendations: [
      { tool: "getContent", reason: "回到远端继续查看页面正文", priority: 1, args: { id: { source: "input", path: "id" } } },
      { tool: "listAttachments", reason: "继续查看这个页面的附件", priority: 0, args: { id: { source: "input", path: "id" } } },
      { tool: "uploadMarkdown", reason: "基于本地文件回传修改后的页面", priority: -1 },
    ],
  },

  // rest
  callRestApi: {
    costHint: "1 REST 请求(任意 method,POST/PUT/DELETE 不缓存)",
    nextBestTools: ["searchContent", "getContent"],
    recommendations: [
      { tool: "getContent", reason: "如果这个 REST 调用针对页面，可回读页面正文", priority: 0, args: { id: { source: "input", path: "pathParams.id" } } },
      { tool: "searchContent", reason: "如果 REST 返回不够直观，可退回内容搜索", priority: -1 },
      { tool: "listRestApis", reason: "继续查看其他官方 REST 模板", priority: -2 },
    ],
  },
  listRestApis: {
    costHint: "1 REST 请求(15s 缓存)",
    nextBestTools: ["callRestApi"],
    recommendations: [
      { tool: "callRestApi", reason: "挑一个模板继续直连 REST 端点", priority: 0 },
      { tool: "searchContent", reason: "如果只是查页面内容，可回到高层命令", priority: -1 },
    ],
  },

  // metadata
  urlParse: {
    costHint: "0 REST 请求(纯字符串解析,不发请求)",
    nextBestTools: ["getContent", "getSpace", "searchContent"],
    recommendations: [
      { tool: "getContent", reason: "如果 URL 指向页面，可直接读取正文", priority: 0, args: { id: { source: "payload", path: "params.pageId" } } },
      { tool: "getSpace", reason: "如果 URL 指向空间，可继续读取空间详情", priority: -1, args: { spaceKey: { source: "payload", path: "params.spaceKey" } } },
      { tool: "searchContent", reason: "如果 URL 无法直接命中，可退回搜索", priority: -2 },
    ],
  },
};

export async function registerTools(registry: CliRegistry, role: Role, options: RegisterToolsOptions = {}): Promise<void> {
  const { commandName, onGroupRegister } = options;

  if (commandName) {
    const group = await resolveCommandGroup(commandName);
    if (group && hasToolGroup(role, group)) {
      registerGroup(registry, group, onGroupRegister);
      return;
    }
  }

  for (const group of getToolGroupNames()) {
    if (!hasToolGroup(role, group)) continue;
    registerGroup(registry, group, onGroupRegister);
  }
}

function registerGroup(
  registry: CliRegistry,
  group: ReturnType<typeof getToolGroupNames>[number],
  onGroupRegister?: (group: ReturnType<typeof getToolGroupNames>[number], commands: string[]) => void,
): void {
  const before = new Set(registry.list().map((command) => command.name));
  const loader = groupLoaders[group];
  const register = loader();
  register(registry);
  for (const name of registry.list().map((command) => command.name).filter((name) => !before.has(name))) {
    const meta = COMMAND_METADATA[name];
    if (meta) {
      const tool = registry.get(name);
      if (tool) tool.metadata = meta;
    }
  }
  const added = registry.list().map((command) => command.name).filter((name) => !before.has(name));
  onGroupRegister?.(group, added);
}

async function resolveCommandGroup(commandName: string): Promise<ReturnType<typeof getToolGroupNames>[number] | undefined> {
  try {
    const { commandToGroup } = await import("./command-groups.generated.js");
    const group = commandToGroup[commandName];
    return group as ReturnType<typeof getToolGroupNames>[number] | undefined;
  } catch {
    return undefined;
  }
}

function getToolGroupNames() {
  return ["init", "install", "convert", "metadata", "rest", "space", "content", "labels", "attachments", "transfer"] as const;
}
