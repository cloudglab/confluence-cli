/** 必填字符串：去空白后空串抛错，否则返回裁剪后的值。 */
export function requireNonBlank(value: string | undefined | null, message: string): string {
  if (typeof value !== "string") throw new Error(message);
  const text = value.trim();
  if (text === "") throw new Error(message);
  return text;
}
