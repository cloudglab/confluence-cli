import { describe, expect, it } from "vitest";
import { getToolGroups, hasToolGroup } from "../../src/core/roles.js";

describe("roles", () => {
  it("exposes role tool groups", () => {
    expect(getToolGroups("full")).toContain("transfer");
    expect(getToolGroups("reader")).not.toContain("transfer");
    expect(getToolGroups("writer")).toContain("transfer");
  });

  it("checks a role group", () => {
    expect(hasToolGroup("reader", "content")).toBe(true);
    expect(hasToolGroup("reader", "transfer")).toBe(false);
    expect(hasToolGroup("writer", "install")).toBe(true);
  });
});
