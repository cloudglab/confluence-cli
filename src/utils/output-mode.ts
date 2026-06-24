import type { JsonContentResult } from "../types/common.js";

/**
 * 三档 output mode,默认 `compact`。
 *
 * - compact:紧凑 JSON,不裁剪;不注入 meta;**单行 JSON**(默认)
 * - normal :不裁剪;从结果里抽取 `source/partial/page/limit/total/scanned/durationMs/cacheHit/fallbackUsed` 进 `meta`;**单行 JSON**
 * - verbose:原样返回;**单行 JSON**(不缩进,跨 CLI 一致)
 *
 * 历史:confluence-cli 之前默认 `JSON.stringify(value, null, 2)`(pretty)。这次改为单行 + 三档,优先为 Agent / Skill 消费,
 * 人类要 pretty 时用 `| jq` 即可。
 */
export type OutputMode = "compact" | "normal" | "verbose";

let currentOutputMode: OutputMode = "compact";

const META_KEYS = [
  "source",
  "partial",
  "page",
  "limit",
  "total",
  "scanned",
  "durationMs",
  "cacheHit",
  "fallbackUsed",
] as const;

export function setGlobalOutputMode(mode: OutputMode): void {
  currentOutputMode = mode;
}

export function getGlobalOutputMode(): OutputMode {
  return currentOutputMode;
}

export function isValidOutputMode(value: string): value is OutputMode {
  return value === "compact" || value === "normal" || value === "verbose";
}

/**
 * 把任意 handler 返回值按 mode 规整为最终 JSON payload。
 * 注意:这个函数本身不做 JSON.stringify,只做形状调整。是否单行由 `buildJsonContentResult` 决定。
 */
export function normalizePayload(value: unknown, mode: OutputMode): unknown {
  if (mode === "verbose") return value;
  if (mode === "normal") return normalizeNormalPayload(value);
  return normalizeCompactPayload(value);
}

function normalizeCompactPayload(value: unknown): unknown {
  return value;
}

function normalizeNormalPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return value;

  const record = value as Record<string, unknown>;
  const meta = extractMeta(record);
  return meta ? { ...record, meta } : record;
}

function extractMeta(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  for (const key of META_KEYS) {
    if (key in record) meta[key] = record[key];
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 把 meta 浅合并到对象结果的 `meta` 字段上,非对象原样返回。
 * 用法:handler 里 `return withToolMeta(result, { requestCount, durationMs })`。
 */
export function withToolMeta(value: unknown, meta: Record<string, unknown>): unknown {
  if (!isPlainObject(value)) return value;
  const existing = (value as Record<string, unknown>).meta;
  return {
    ...value,
    meta: {
      ...(isPlainObject(existing) ? existing : {}),
      ...meta,
    },
  };
}

/**
 * 框架层 meta 注入。在 cli.ts 写 stdout 前调:
 * - 如果 result 是 JSON 对象(典型情况),把 meta 浅合并进 `result.meta` 后重新 `JSON.stringify`(单行);
 * - 如果 text 不是 JSON(纯文本错误 / 预览),原样返回;
 * - 如果 result 是数组或非对象,跳过注入(避免破坏形状)。
 *
 * 之所以在 output-mode.ts 而不是 cli.ts 实现,是因为它依赖 `withToolMeta` 语义保持一致,
 * 也方便单测覆盖(无需启 axios)。
 */
export function appendCommandMeta(result: JsonContentResult, meta: Record<string, unknown>): JsonContentResult {
  if (result.content.length === 0) return result;
  const first = result.content[0];
  if (first.type !== "text") return result;
  try {
    const parsed = JSON.parse(first.text);
    if (!isPlainObject(parsed)) return result;
    const updated = withToolMeta(parsed, meta) as Record<string, unknown>;
    return { content: [{ type: "text", text: JSON.stringify(updated) }] };
  } catch {
    return result;
  }
}

/**
 * 把 handler 返回值规整 + JSON.stringify(单行)后包成 JsonContentResult。
 * handler 显式传 `mode` 优先,否则用全局 mode。
 */
export function buildJsonContentResult(value: unknown, mode?: OutputMode): JsonContentResult {
  const effective = mode ?? currentOutputMode;
  const payload = normalizePayload(value, effective);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  };
}
