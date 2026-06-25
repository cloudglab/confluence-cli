import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { JsonContentResult } from "../types/common.js";

/**
 * 命令元数据,用于帮 Agent 在跑命令前了解代价和后续推荐步骤。
 * 对齐 zentao-cli 的 `CliCommandDefinition.metadata`。
 *
 * - `costHint`: 描述本命令的开销(如 "1 REST 请求" / "1-2 REST 请求 + 可能更新缓存");
 *   不写绝对耗时,因为网络/Confluence 实例差异大。
 * - `nextBestTools`: 跑完本命令后,Agent 下一步可能用到的命令(用命令名数组)。
 *   渲染在 `help <command>` 末尾。
 * - `cacheable`: 标记本命令读路径(GET)是否会被 15s 缓存(默认 true)。
 * - `idempotent`: 标记本命令是否幂等(默认 true,只对写操作 false)。
 */
export interface CommandMetadata {
  costHint?: string;
  nextBestTools?: string[];
  cacheable?: boolean;
  idempotent?: boolean;
}

/**
 * 注册命令的类型。`schema` 用 ZodRawShape(直接 `{ key: zodType }`),
 * 对齐 zentao-cli 的 CliCommandDefinition,去掉 `z.object(...)` 包装。
 *
 * - `parseCommandInput` 内部会用 `z.object(schema).strict().parse(...)` 做最终校验,
 *   把单个字段的类型转换/默认值交还 zod,CLI 层只负责 argv 解析。
 * - 旧约定(`z.object({...}).refine(...)`)中 `.refine()` 已不再支持;调用方在 handler 里手抛错。
 */
export type CliHandler<TInput extends Record<string, unknown> = Record<string, unknown>> =
  (input: TInput) => Promise<JsonContentResult> | JsonContentResult;

export interface RegisteredTool<TInput extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description?: string;
  schema: ZodRawShape;
  handler: CliHandler<TInput>;
  metadata?: CommandMetadata;
}

export interface CliRegistry {
  tool<TShape extends ZodRawShape, TInput extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    schema: TShape,
    handler: CliHandler<TInput & z.infer<z.ZodObject<TShape>>>,
    description?: string,
    metadata?: CommandMetadata,
  ): void;
  get(name: string): RegisteredTool | undefined;
  list(): RegisteredTool[];
}

export class InMemoryCliRegistry implements CliRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  tool<TShape extends ZodRawShape, TInput extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    schema: TShape,
    handler: CliHandler<TInput & z.infer<z.ZodObject<TShape>>>,
    description?: string,
    metadata?: CommandMetadata,
  ): void {
    this.tools.set(name, {
      name,
      schema,
      handler: handler as CliHandler,
      description,
      metadata,
    });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredTool[] {
    return [...this.tools.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}

/**
 * 把 argv 解析成结构化 input。
 *
 * 流程:
 * 1. `parseArgv` 把 `--key=value` / `--key value` / `--flag` 还原成 `{ key: value | true | [...] }`;
 * 2. 拒绝 schema 外的 key,报"未知参数";
 * 3. `coerceValue` 把字符串值转成 zod 期望的类型(boolean / number / array / object / union);
 * 4. `z.object(schema).strict().parse(converted)` 让 zod 接管 z.coerce / 默认值 / 可选性等校验。
 *
 * 不再用 `z.object({...}).refine(...)`:`.refine()` 需要调用方在 handler 里手抛错。
 */
export function parseCommandInput(schema: ZodRawShape, args: string[]): Record<string, unknown> {
  const raw = parseArgv(args);

  const unknownKeys = Object.keys(raw).filter((key) => !(key in schema));
  if (unknownKeys.length > 0) {
    throw new Error(`未知参数: ${unknownKeys.map((key) => `--${key}`).join(", ")}`);
  }

  const converted: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (!(key in raw)) continue;
    converted[key] = coerceValue(selectValueForSchema(raw[key], fieldSchema), fieldSchema);
  }

  return z.object(schema).strict().parse(converted) as Record<string, unknown>;
}

function parseArgv(args: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      throw new Error(`无法识别的位置参数: ${token}`);
    }

    const equalsIndex = token.indexOf("=");
    const key = equalsIndex >= 0 ? token.slice(2, equalsIndex) : token.slice(2);
    if (!key) throw new Error("检测到空参数名。");

    const next = args[index + 1];
    const hasInlineValue = equalsIndex >= 0;
    const hasExplicitValue = !hasInlineValue && typeof next === "string" && !next.startsWith("--");
    const value = hasInlineValue ? token.slice(equalsIndex + 1) : hasExplicitValue ? next : true;

    if (hasExplicitValue) index += 1;
    appendArg(result, key, value);
  }

  return result;
}

function appendArg(target: Record<string, unknown>, key: string, value: unknown): void {
  const current = target[key];
  if (current === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  target[key] = [current, value];
}

function selectValueForSchema(value: unknown, schema: ZodTypeAny): unknown {
  if (!Array.isArray(value)) return value;
  const unwrapped = unwrapSchema(schema);
  return unwrapped instanceof z.ZodArray ? value : value[value.length - 1];
}

function coerceValue(value: unknown, schema: ZodTypeAny): unknown {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodBoolean) {
    return toBoolean(value);
  }

  if (unwrapped instanceof z.ZodNumber) {
    return toNumber(value);
  }

  if (unwrapped instanceof z.ZodArray) {
    const items: unknown[] = Array.isArray(value)
      ? value
      : typeof value === "string" && value.trim().startsWith("[")
        ? parseJsonValue(value, "数组参数") as unknown[]
        : typeof value === "string"
          ? value.split(",").map((item) => item.trim()).filter(Boolean)
          : [value];

    return items.map((item) => coerceValue(item, unwrapped.element));
  }

  if (unwrapped instanceof z.ZodObject) {
    if (typeof value !== "string") return value;
    return parseJsonValue(value, "对象参数");
  }

  if (unwrapped instanceof z.ZodUnion) {
    for (const option of unwrapped._def.options) {
      try {
        return coerceValue(value, option);
      } catch {
        // try next option
      }
    }
    return value;
  }

  return value;
}

function parseJsonValue(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法解析${label}: ${value}(${message})`);
  }
}

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return unwrapSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return unwrapSchema((schema._def as { innerType: ZodTypeAny }).innerType);
  if (schema instanceof z.ZodEffects) return unwrapSchema(schema.innerType());
  if (schema instanceof z.ZodPipeline) return unwrapSchema(schema._def.out);
  return schema;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  throw new Error(`无法解析布尔值: ${String(value)}`);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error(`无法解析数字: ${String(value)}`);
}