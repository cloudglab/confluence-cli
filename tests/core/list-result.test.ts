import { describe, expect, it } from "vitest";
import { extractItems, toClientPaginatedListResult, toServerListResult } from "../../src/core/list-result.js";

describe("extractItems", () => {
  it("支持数组响应和对象中的指定数组字段", () => {
    expect(extractItems([{ id: 1 }], ["items"])).toEqual([{ id: 1 }]);
    expect(extractItems({ rows: [{ id: 2 }], items: [{ id: 3 }] }, ["items", "rows"])).toEqual([{ id: 3 }]);
  });

  it("对无效响应返回空数组", () => {
    expect(extractItems("invalid", ["items"])).toEqual([]);
    expect(extractItems({ total: 1 }, ["items"])).toEqual([]);
  });
});

describe("toServerListResult", () => {
  it("数组响应会生成 server-full-list 结果", () => {
    expect(toServerListResult([{ id: 1 }, { id: 2 }], ["pages"])).toEqual({
      source: "server-full-list",
      partial: false,
      page: 1,
      limit: 2,
      total: 2,
      itemKey: "pages",
      items: [{ id: 1 }, { id: 2 }],
    });
  });

  it("对象响应优先使用服务端分页元信息", () => {
    expect(toServerListResult({ page: "3", limit: "10", total: "99", results: [{ id: 1 }] }, ["results"])).toMatchObject({
      source: "server-paginated",
      page: 3,
      limit: 10,
      total: 99,
      items: [{ id: 1 }],
    });
  });
});

describe("toClientPaginatedListResult", () => {
  it("在客户端分页并返回 scanned 信息", () => {
    expect(toClientPaginatedListResult({ results: [{ id: 1 }, { id: 2 }, { id: 3 }] }, ["results"], { page: 2, limit: 2 })).toEqual({
      source: "client-paginated",
      partial: false,
      page: 2,
      limit: 2,
      total: 3,
      scanned: 3,
      itemKey: "results",
      items: [{ id: 3 }],
    });
  });
});
