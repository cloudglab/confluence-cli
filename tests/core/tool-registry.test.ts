import { describe, expect, it } from "vitest";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";
import { registerTools } from "../../src/core/tool-registry.js";

describe("registerTools", () => {
  it("registers full role command surface", async () => {
    const registry = new InMemoryCliRegistry();

    await registerTools(registry, "full");

    const names = registry.list().map((command) => command.name);
    expect(names).toContain("install");
    expect(names).toContain("update");
    expect(names).toContain("searchContent");
    expect(names).toContain("uploadMarkdown");
  });

  it("filters transfer commands from reader role", async () => {
    const registry = new InMemoryCliRegistry();

    await registerTools(registry, "reader");

    const names = registry.list().map((command) => command.name);
    expect(names).toContain("searchContent");
    expect(names).not.toContain("uploadMarkdown");
  });

  it("supports targeted registration by command name", async () => {
    const registry = new InMemoryCliRegistry();

    await registerTools(registry, "full", { commandName: "searchContent" });

    const names = registry.list().map((command) => command.name);
    expect(names).toContain("searchContent");
    expect(names).toContain("getContent");
    expect(names).not.toContain("uploadMarkdown");
  });
});
