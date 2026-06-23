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
  initConfluence: { costHint: "0-1 REST 请求(校验连接)", nextBestTools: ["whoami", "searchContent"] },

  // space
  listSpaces: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["getSpace", "searchContent"] },
  getSpace: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["listSpaces", "searchContent"] },

  // content
  searchContent: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["findContent", "getContent", "report"] },
  getContent: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["getPageChildren", "addLabels", "downloadPage"] },
  getPageSnapshot: { costHint: "5 REST 请求并行(15s 缓存, 重复调用几乎免费)", nextBestTools: ["getContent", "getLabels", "getComments", "listAttachments", "getPageChildren"] },
  findContent: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["getContent", "searchContent"] },
  report: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["searchContent", "getContent"] },
  getPageChildren: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["getContent", "searchContent"] },
  getComments: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["getContent"] },
  addComment: { costHint: "1 REST 请求,需要 --confirm true", nextBestTools: ["getComments", "getContent"], cacheable: false, idempotent: false },
  deleteContent: { costHint: "1 REST 请求,需要 --confirm true", cacheable: false, idempotent: false },

  // labels
  addLabels: { costHint: "1 REST 请求,需要 --confirm true", nextBestTools: ["getLabels", "getContent"], cacheable: false, idempotent: false },
  deleteLabel: { costHint: "1 REST 请求,需要 --confirm true", cacheable: false, idempotent: false },
  getLabels: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["addLabels", "deleteLabel", "getContent"] },

  // attachments
  listAttachments: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["downloadAttachment", "uploadAttachment"] },
  uploadAttachment: { costHint: "1 REST 请求,需要 --confirm true", nextBestTools: ["listAttachments"], cacheable: false, idempotent: false },
  updateAttachment: { costHint: "1 REST 请求,需要 --confirm true", cacheable: false, idempotent: false },
  downloadAttachment: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["listAttachments"] },

  // transfer
  uploadMarkdown: { costHint: "1-3 REST 请求(上传/转换/确认),需要 --confirm true", nextBestTools: ["downloadPage", "getContent"], cacheable: false, idempotent: false },
  uploadHtml: { costHint: "1-3 REST 请求(上传/转换/确认),需要 --confirm true", nextBestTools: ["getContent", "downloadPage"], cacheable: false, idempotent: false },
  downloadPage: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["getContent", "uploadMarkdown"] },

  // rest
  callRestApi: { costHint: "1 REST 请求(任意 method,POST/PUT/DELETE 不缓存)", nextBestTools: ["searchContent", "getContent"] },
  listRestApis: { costHint: "1 REST 请求(15s 缓存)", nextBestTools: ["callRestApi"] },

  // metadata
  urlParse: { costHint: "0 REST 请求(纯字符串解析,不发请求)", nextBestTools: ["getContent", "getSpace", "searchContent"] },
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
