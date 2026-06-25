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

/**
 * 列出某个角色可见的工具分组。
 *
 * @internal 仅测试 / 外部脚本消费,CLI 运行时不直接调用(角色过滤走
 * `command-groups.generated.ts`)。保留导出是为了让 `tests/core/roles.test.ts`
 * 能断言分组表,以及外部编排脚本可读取角色能力。不要在 handler 里依赖本函数。
 */
export function getToolGroups(role: Role): ToolGroup[] {
  return ROLE_TOOL_GROUPS[role];
}
