import { describe, expect, it } from "vitest";

import { buildJsonContentResult, normalizePayload } from "../../src/utils/output-mode.js";

describe("output-mode", () => {
  it("compact 模式不裁剪长字符串和数组", () => {
    const value = {
      text: "x".repeat(700),
      items: Array.from({ length: 30 }, (_, index) => index + 1),
    };

    expect(normalizePayload(value, "compact")).toEqual(value);

    const result = buildJsonContentResult(value, "compact");
    const parsed = JSON.parse(result.content[0]!.text) as typeof value;
    expect(parsed.text).toHaveLength(700);
    expect(parsed.items).toHaveLength(30);
  });
});
