import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { InMemoryCliRegistry, parseCommandInput } from "../../src/core/cli-registry.js";

describe("InMemoryCliRegistry", () => {
  it("支持注册、读取和排序列出命令", () => {
    const registry = new InMemoryCliRegistry();
    const handler = vi.fn(() => ({ content: [{ type: "text" as const, text: "ok" }] }));

    registry.tool("beta", z.object({ id: z.number() }), handler);
    registry.tool("alpha", z.object({ name: z.string() }), handler);

    expect(registry.get("beta")?.name).toBe("beta");
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.list().map((command) => command.name)).toEqual(["alpha", "beta"]);
  });
});

describe("parseCommandInput", () => {
  it("支持布尔、数字、默认值和 --key=value", () => {
    const schema = z.object({ name: z.string(), force: z.boolean().optional(), page: z.number().default(1), count: z.number() });

    expect(parseCommandInput(schema, ["--name=demo", "--force", "--count", "5"])).toEqual({
      name: "demo",
      force: true,
      page: 1,
      count: 5,
    });
  });

  it("支持重复参数、逗号数组、JSON 数组和对象", () => {
    const schema = z.object({ repeated: z.array(z.string()), csv: z.array(z.string()), json: z.array(z.number()), meta: z.object({ enabled: z.boolean() }) });

    expect(parseCommandInput(schema, ["--repeated", "alpha", "--repeated", "beta", "--csv", "a, b", "--json", "[1,2]", "--meta", '{"enabled":true}'])).toEqual({
      repeated: ["alpha", "beta"],
      csv: ["a", "b"],
      json: [1, 2],
      meta: { enabled: true },
    });
  });

  it("拒绝 schema 外参数和位置参数", () => {
    expect(() => parseCommandInput(z.object({ name: z.string() }), ["--name", "demo", "--ignored", "value"])).toThrow("未知参数: --ignored");
    expect(() => parseCommandInput(z.object({ name: z.string() }), ["demo"])).toThrow("无法识别的位置参数: demo");
  });
});
