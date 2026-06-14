import type { JsonContentResult } from "../types/common.js";

export function textResult(text: string): JsonContentResult {
  return { content: [{ type: "text", text }] };
}

export function jsonResult(value: unknown): JsonContentResult {
  return textResult(JSON.stringify(value, null, 2));
}
