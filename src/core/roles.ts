import type { Role } from "../types/common.js";

export type ToolGroup = "init" | "convert" | "metadata" | "rest" | "space" | "content" | "labels" | "attachments" | "transfer" | "install";

const ROLE_TOOL_GROUPS: Record<Role, ToolGroup[]> = {
  full: ["init", "install", "convert", "metadata", "rest", "space", "content", "labels", "attachments", "transfer"],
  reader: ["init", "install", "convert", "metadata", "rest", "space", "content", "labels", "attachments"],
  writer: ["init", "install", "convert", "metadata", "rest", "space", "content", "labels", "attachments", "transfer"],
};

export function hasToolGroup(role: Role, group: ToolGroup): boolean {
  return ROLE_TOOL_GROUPS[role].includes(group);
}

export function getToolGroups(role: Role): ToolGroup[] {
  return ROLE_TOOL_GROUPS[role];
}
