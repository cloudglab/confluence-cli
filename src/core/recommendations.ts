import type { CommandMetadata } from "./cli-registry.js";
import { describeCommandReason } from "./command-descriptions.js";

export interface RecommendationArgSource {
  source: "input" | "payload";
  path: string;
}

export interface CommandRecommendationDefinition {
  tool: string;
  reason?: string;
  priority?: number;
  args?: Record<string, RecommendationArgSource>;
}

export interface ResolvedCommandRecommendation {
  tool: string;
  reason: string;
  priority: number;
  args?: Record<string, unknown>;
  example?: string;
}

export function resolveRecommendations(options: {
  metadata?: CommandMetadata;
  input: Record<string, unknown>;
  payload: unknown;
  availableCommands: Set<string>;
}): ResolvedCommandRecommendation[] {
  const definitions = buildRecommendationDefinitions(options.metadata)
    .filter((item) => options.availableCommands.has(item.tool));

  return definitions
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const priorityDiff = (right.item.priority ?? 0) - (left.item.priority ?? 0);
      return priorityDiff !== 0 ? priorityDiff : left.index - right.index;
    })
    .map(({ item }) => resolveRecommendation(item, options.input, options.payload));
}

function buildRecommendationDefinitions(metadata?: CommandMetadata): CommandRecommendationDefinition[] {
  if (metadata?.recommendations && metadata.recommendations.length > 0) {
    return metadata.recommendations;
  }

  return (metadata?.nextBestTools ?? []).map((tool) => ({
    tool,
    reason: describeCommandReason(tool),
    priority: 0,
  }));
}

function resolveRecommendation(
  definition: CommandRecommendationDefinition,
  input: Record<string, unknown>,
  payload: unknown,
): ResolvedCommandRecommendation {
  const reason = definition.reason ?? describeCommandReason(definition.tool);
  const priority = definition.priority ?? 0;
  const resolvedArgs = resolveRecommendationArgs(definition.args, input, payload);

  if (!resolvedArgs) {
    return { tool: definition.tool, reason, priority };
  }

  return {
    tool: definition.tool,
    reason,
    priority,
    args: resolvedArgs,
    example: buildRecommendationExample(definition.tool, resolvedArgs),
  };
}

function resolveRecommendationArgs(
  args: Record<string, RecommendationArgSource> | undefined,
  input: Record<string, unknown>,
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!args || Object.keys(args).length === 0) return undefined;

  const resolved: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(args)) {
    const root = source.source === "input" ? input : payload;
    const value = getValueByPath(root, source.path);
    if (value === undefined) return undefined;
    resolved[key] = value;
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function getValueByPath(root: unknown, path: string): unknown {
  if (!path) return root;
  let current = root;
  for (const segment of path.split(".")) {
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) return undefined;
  }
  return current;
}

function buildRecommendationExample(tool: string, args: Record<string, unknown>): string {
  const suffix = Object.entries(args)
    .flatMap(([key, value]) => [`--${key}`, formatCliArg(value)]);
  return ["confluence", tool, ...suffix].join(" ");
}

function formatCliArg(value: unknown): string {
  if (typeof value === "string") {
    return /\s/.test(value) ? JSON.stringify(value) : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
