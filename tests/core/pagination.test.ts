import { describe, expect, it } from "vitest";
import { fetchAllPages, normalizePagination, normalizeTotalPages } from "../../src/core/pagination.js";

describe("normalizePagination", () => {
  it("对非法分页参数回退默认值", () => {
    expect(normalizePagination({ page: 0, limit: -5 })).toEqual({ page: 1, limit: 20 });
    expect(normalizePagination({ page: Number.NaN, limit: Number.POSITIVE_INFINITY })).toEqual({ page: 1, limit: 20 });
  });

  it("向下取整并限制最大 limit", () => {
    expect(normalizePagination({ page: 3.8, limit: 150.2 })).toEqual({ page: 3, limit: 100 });
  });
});

describe("normalizeTotalPages", () => {
  it("支持字符串 total 并限制最大页数", () => {
    expect(normalizeTotalPages("99", 10)).toBe(10);
    expect(normalizeTotalPages(999999, 1)).toBe(1000);
  });
});

describe("fetchAllPages", () => {
  it("先取第一页，再并发补齐剩余页", async () => {
    const requestedPages: number[] = [];

    const items = await fetchAllPages<number>({
      pageSize: 2,
      concurrency: 2,
      async fetchPage(page) {
        requestedPages.push(page);
        return {
          items: [page * 10 + 1, page * 10 + 2],
          total: 5,
        };
      },
    });

    expect(requestedPages).toEqual([1, 2, 3]);
    expect(items).toEqual([11, 12, 21, 22, 31, 32]);
  });
});
