import {
  buildJsonContentResult,
  type OutputMode,
} from "./output-mode.js";
import type { JsonContentResult } from "../types/common.js";

export { listResult, type ListResult, type ListResultMeta } from "../core/list-result.js";

/**
 * @deprecated 用 `jsonResult` 即可,不要直接 `textResult` 拼 JSON 字符串(会绕开 output mode 统一处理)。
 * 仍保留以兼容现存纯文本命令(如 error / preview 提示)。
 */
export function textResult(text: string): JsonContentResult {
  return { content: [{ type: "text", text }] };
}

/**
 * 统一 JSON 出口。`mode` 缺省走全局 mode(`setGlobalOutputMode` / `--output` 控制),
 * handler 也可以显式传 `mode` 覆盖。
 *
 * 三档 mode 行为见 `output-mode.ts` 顶部注释。
 */
export function jsonResult(value: unknown, mode?: OutputMode): JsonContentResult {
  return buildJsonContentResult(value, mode);
}

export {
  setGlobalOutputMode,
  getGlobalOutputMode,
  isValidOutputMode,
  withToolMeta,
} from "./output-mode.js";

export type { OutputMode } from "./output-mode.js";
