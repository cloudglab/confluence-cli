import { describe, expect, it } from "vitest";

import { resolveRecommendations } from "../../src/core/recommendations.js";

describe("resolveRecommendations", () => {
  it("falls back to nextBestTools descriptions", () => {
    const next = resolveRecommendations({
      metadata: { nextBestTools: ["getContent"] },
      input: {},
      payload: {},
      availableCommands: new Set(["getContent"]),
    });

    expect(next).toEqual([
      {
        tool: "getContent",
        reason: "获取页面或博客内容",
        priority: 0,
      },
    ]);
  });

  it("omits args and example when path resolution fails", () => {
    const next = resolveRecommendations({
      metadata: {
        recommendations: [
          { tool: "getContent", args: { id: { source: "payload", path: "missing.id" } } },
        ],
      },
      input: {},
      payload: {},
      availableCommands: new Set(["getContent"]),
    });

    expect(next).toEqual([
      {
        tool: "getContent",
        reason: "获取页面或博客内容",
        priority: 0,
      },
    ]);
  });

  it("sorts by priority and fills example from resolved args", () => {
    const next = resolveRecommendations({
      metadata: {
        recommendations: [
          { tool: "searchContent", priority: -1 },
          { tool: "getContent", priority: 2, args: { id: { source: "input", path: "id" } } },
        ],
      },
      input: { id: 123 },
      payload: {},
      availableCommands: new Set(["getContent", "searchContent"]),
    });

    expect(next[0]).toEqual({
      tool: "getContent",
      reason: "获取页面或博客内容",
      priority: 2,
      args: { id: 123 },
      example: "confluence getContent --id 123",
    });
    expect(next[1]?.tool).toBe("searchContent");
  });

  it("combines input and payload args for attachment follow-up", () => {
    const next = resolveRecommendations({
      metadata: {
        recommendations: [
          {
            tool: "downloadAttachment",
            args: {
              id: { source: "input", path: "id" },
              attachmentId: { source: "payload", path: "results.0.id" },
            },
          },
        ],
      },
      input: { id: "123" },
      payload: { results: [{ id: "att-1" }] },
      availableCommands: new Set(["downloadAttachment"]),
    });

    expect(next).toEqual([
      {
        tool: "downloadAttachment",
        reason: "下载页面附件",
        priority: 0,
        args: { id: "123", attachmentId: "att-1" },
        example: "confluence downloadAttachment --id 123 --attachmentId att-1",
      },
    ]);
  });

  it("resolves nested page id from upload payload", () => {
    const next = resolveRecommendations({
      metadata: {
        recommendations: [
          { tool: "getContent", priority: 1, args: { id: { source: "payload", path: "page.id" } } },
        ],
      },
      input: {},
      payload: { page: { id: "98765" } },
      availableCommands: new Set(["getContent"]),
    });

    expect(next).toEqual([
      {
        tool: "getContent",
        reason: "获取页面或博客内容",
        priority: 1,
        args: { id: "98765" },
        example: "confluence getContent --id 98765",
      },
    ]);
  });

  it("reuses multiple input args for write follow-up", () => {
    const next = resolveRecommendations({
      metadata: {
        recommendations: [
          {
            tool: "downloadAttachment",
            args: {
              id: { source: "input", path: "id" },
              attachmentId: { source: "input", path: "attachmentId" },
            },
          },
        ],
      },
      input: { id: "123", attachmentId: "att-9" },
      payload: {},
      availableCommands: new Set(["downloadAttachment"]),
    });

    expect(next).toEqual([
      {
        tool: "downloadAttachment",
        reason: "下载页面附件",
        priority: 0,
        args: { id: "123", attachmentId: "att-9" },
        example: "confluence downloadAttachment --id 123 --attachmentId att-9",
      },
    ]);
  });

  it("resolves nested input params for rest follow-up", () => {
    const next = resolveRecommendations({
      metadata: {
        recommendations: [
          { tool: "getContent", args: { id: { source: "input", path: "pathParams.id" } } },
        ],
      },
      input: { pathParams: { id: "555" } },
      payload: {},
      availableCommands: new Set(["getContent"]),
    });

    expect(next).toEqual([
      {
        tool: "getContent",
        reason: "获取页面或博客内容",
        priority: 0,
        args: { id: "555" },
        example: "confluence getContent --id 555",
      },
    ]);
  });
});
