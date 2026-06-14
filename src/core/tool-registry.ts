import type { CliRegistry } from "./cli-registry.js";
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
