import { normalizePagination, type PaginationInput } from "./pagination.js";

export interface ListResult<T = unknown> {
  source: "server-paginated" | "server-full-list" | "client-paginated";
  partial: boolean;
  page: number;
  limit: number;
  total: number;
  scanned?: number;
  itemKey: string;
  items: T[];
}

export function extractItems<T = unknown>(response: unknown, keys: string[]): T[] {
  if (Array.isArray(response)) return response as T[];
  if (typeof response !== "object" || response === null) return [];

  const record = response as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

export function toServerListResult<T = unknown>(response: unknown, keys: string[], pagination: PaginationInput = {}): ListResult<T> {
  const items = extractItems<T>(response, keys);
  const normalized = normalizePagination(pagination);

  if (Array.isArray(response)) {
    return {
      source: "server-full-list",
      partial: false,
      page: 1,
      limit: items.length,
      total: items.length,
      itemKey: keys[0] ?? "items",
      items,
    };
  }

  const record = typeof response === "object" && response !== null ? response as Record<string, unknown> : {};
  const page = toPositiveInteger(record.page) ?? normalized.page;
  const limit = toPositiveInteger(record.limit) ?? normalized.limit;
  const total = toNonNegativeInteger(record.total) ?? items.length;

  return {
    source: "server-paginated",
    partial: false,
    page,
    limit,
    total,
    itemKey: keys[0] ?? "items",
    items,
  };
}

export function toClientPaginatedListResult<T = unknown>(response: unknown, keys: string[], pagination: PaginationInput = {}): ListResult<T> {
  const items = extractItems<T>(response, keys);
  const normalized = normalizePagination(pagination);
  const start = (normalized.page - 1) * normalized.limit;
  const window = items.slice(start, start + normalized.limit);

  return {
    source: "client-paginated",
    partial: false,
    page: normalized.page,
    limit: normalized.limit,
    total: items.length,
    scanned: items.length,
    itemKey: keys[0] ?? "items",
    items: window,
  };
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toPositiveInteger(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function toNonNegativeInteger(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  if (parsed === undefined || parsed < 0) return undefined;
  return Math.floor(parsed);
}
