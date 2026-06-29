import { summarizeList, type ListSummary } from "./list-summary.js";

/**
 * 列表型结果的标准包装,帮 Agent 一眼看清分页元信息。
 * 对齐 zentao-cli 的 `ListResult` 约定。
 *
 * 字段含义:
 * - `source`   : 数据来源(`"rest"` / `"cql"` / `"local"`)
 * - `partial`  : `items` 是否是全集(分页时为 true,一次性返回全量为 false)
 * - `page`     : 当前页码(从 1 开始;无分页时为 1)
 * - `limit`    : 单次最多返回条数
 * - `total`    : 实际匹配到的总条数(可能 = items.length 时 partial=false)
 * - `scanned`  : 实际扫描的条数(可选,部分 API 没暴露就用 total)
 * - `itemKey`  : `items[i]` 的语义名(`"pages"` / `"spaces"` / `"results"` / `"attachments"`),让 Agent 知道怎么取
 * - `items`    : 列表本体
 *
 * 用法:
 * ```ts
 * return jsonResult(listResult(items, {
 *   source: "rest",
 *   page: 1,
 *   limit: 25,
 *   total: 100,
 *   itemKey: "pages",
 * }));
 * ```
 */
export interface ListResult<T = unknown> {
  source: string;
  partial: boolean;
  page: number;
  limit: number;
  total: number;
  scanned?: number;
  itemKey: string;
  items: T[];
  summary?: ListSummary;
  meta?: { processed: true; partial: boolean; total: number };
}

export interface ListSummaryOptions {
  sortKey?: "deadline" | "updatedAt" | "createdAt";
  groupKey?: string;
  topN?: number;
}

export type ListResultMeta<T> = Omit<ListResult<T>, "items" | "partial" | "summary" | "meta"> & {
  /** 手动指定 partial;不传时按 `items.length < total` 推断 */
  partial?: boolean;
  summary?: ListSummaryOptions;
};

export function listResult<T>(items: T[], meta: ListResultMeta<T>): ListResult<T> {
  const summaryOptions = meta.summary;
  const inferredGroupKey = summaryOptions?.groupKey ?? (items.some((item) => isRecord(item) && "space" in item) ? "space" : undefined);
  return {
    source: meta.source,
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    scanned: meta.scanned,
    itemKey: meta.itemKey,
    items,
    partial: meta.partial ?? items.length < meta.total,
    summary: summarizeList(items as Array<{ id: number | string; name?: string; status?: string; deadline?: string; updatedAt?: string; createdAt?: string; productName?: string | number; projectName?: string | number; product?: string | number; project?: string | number }>, {
      ...(summaryOptions ?? {}),
      groupKey: inferredGroupKey,
    }),
    meta: { processed: true, partial: meta.partial ?? items.length < meta.total, total: meta.total },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
