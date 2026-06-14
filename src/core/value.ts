export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    return String(value);
  }

  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
