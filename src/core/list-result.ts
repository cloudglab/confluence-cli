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
}

export type ListResultMeta<T> = Omit<ListResult<T>, "items" | "partial"> & {
  /** 手动指定 partial;不传时按 `items.length < total` 推断 */
  partial?: boolean;
};

export function listResult<T>(items: T[], meta: ListResultMeta<T>): ListResult<T> {
  return {
    source: meta.source,
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    scanned: meta.scanned,
    itemKey: meta.itemKey,
    items,
    partial: meta.partial ?? items.length < meta.total,
  };
}

/**
 * 从任意响应中按候选 key 顺序提取 items 数组。
 * - 数组响应直接返回
 * - 对象响应按 `candidateKeys` 顺序找到第一个数组字段
 * - 无效响应(非数组 / 对象无匹配字段)返回 `[]`
 */
export function extractItems<T = unknown>(response: unknown, candidateKeys: string[]): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object") {
    for (const key of candidateKeys) {
      const value = (response as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

/**
 * 服务端分页响应 → `ListResult`。
 * - 数组响应:整段就是全集,`source: "server-full-list"`,`partial: false`
 * - 对象响应:取对象里的 `page` / `limit` / `total`(字符串自动转数字),`source: "server-paginated"`
 * - 无效响应:`source: "rest"`,空数组
 */
export function toServerListResult<T = unknown>(response: unknown, candidateKeys: string[]): ListResult<T> {
  if (Array.isArray(response)) {
    return {
      source: "server-full-list",
      partial: false,
      page: 1,
      limit: response.length,
      total: response.length,
      itemKey: candidateKeys[0] ?? "items",
      items: response as T[],
    };
  }
  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    const items = extractItems<T>(obj, candidateKeys);
    const page = Number(obj.page ?? 1) || 1;
    const limit = Number(obj.limit ?? items.length) || items.length;
    const total = Number(obj.total ?? items.length) || items.length;
    return {
      source: "server-paginated",
      partial: limit * page < total,
      page,
      limit,
      total,
      itemKey: candidateKeys[0] ?? "items",
      items,
    };
  }
  return {
    source: "rest",
    partial: false,
    page: 1,
    limit: 0,
    total: 0,
    itemKey: candidateKeys[0] ?? "items",
    items: [],
  };
}

/**
 * 客户端分页:在 `response` 里抽出 items 后,按 `{ page, limit }` 切一段。
 * - `scanned` 记录被扫描的总数(等于 items.length)
 * - `partial: false`(因为我们已经把对应页全量返回)
 */
export function toClientPaginatedListResult<T = unknown>(
  response: unknown,
  candidateKeys: string[],
  pagination: { page: number; limit: number },
): ListResult<T> {
  const all = extractItems<T>(response, candidateKeys);
  const start = Math.max(0, (pagination.page - 1) * pagination.limit);
  const end = start + pagination.limit;
  const items = all.slice(start, end);
  return {
    source: "client-paginated",
    partial: false,
    page: pagination.page,
    limit: pagination.limit,
    total: all.length,
    scanned: all.length,
    itemKey: candidateKeys[0] ?? "items",
    items,
  };
}
