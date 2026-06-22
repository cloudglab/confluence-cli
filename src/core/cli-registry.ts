import { z, type ZodTypeAny } from "zod";
import type { JsonContentResult, ToolHandler } from "../types/common.js";

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

export interface RegisteredTool<TInput = unknown> {
  name: string;
  description?: string;
  schema: z.ZodType<TInput>;
  handler: ToolHandler<TInput>;
  metadata?: CommandMetadata;
}

export interface CliRegistry {
  tool<TInput>(
    name: string,
    schema: z.ZodType<TInput>,
    handler: ToolHandler<TInput>,
    description?: string,
    metadata?: CommandMetadata,
  ): void;
  get(name: string): RegisteredTool | undefined;
  list(): RegisteredTool[];
}

export class InMemoryCliRegistry implements CliRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  tool<TInput>(
    name: string,
    schema: z.ZodType<TInput>,
    handler: ToolHandler<TInput>,
    description?: string,
    metadata?: CommandMetadata,
  ): void {
    this.tools.set(name, { name, schema, handler: handler as ToolHandler<unknown>, description, metadata });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredTool[] {
    return [...this.tools.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}

export function parseCommandInput(schema: z.ZodType, args: string[]): unknown {
  const raw: Record<string, unknown> = {};

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
    appendArg(raw, key, value);
  }

  const objectSchema = unwrapObjectSchema(schema);
  if (!objectSchema) return schema.parse(raw);

  const shape = objectSchema.shape;
  const unknownKeys = Object.keys(raw).filter((key) => !(key in shape));
  if (unknownKeys.length > 0) {
    throw new Error(`未知参数: ${unknownKeys.map((key) => `--${key}`).join(", ")}`);
  }

  const converted: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(shape) as Array<[string, ZodTypeAny]>) {
    if (!(key in raw)) continue;
    converted[key] = coerceValue(selectValueForSchema(raw[key], fieldSchema), fieldSchema);
  }

  return schema.parse(converted);
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

  if (unwrapped instanceof z.ZodBoolean) return toBoolean(value);
  if (unwrapped instanceof z.ZodNumber) return toNumber(value);
  if (unwrapped instanceof z.ZodString) return typeof value === "string" ? value : String(value);

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
  }

  return value;
}

function parseJsonValue(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法解析${label}: ${value}（${message}）`);
  }
}

function unwrapObjectSchema(schema: z.ZodType): z.AnyZodObject | undefined {
  const unwrapped = unwrapSchema(schema as ZodTypeAny);
  return unwrapped instanceof z.ZodObject ? unwrapped : undefined;
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
