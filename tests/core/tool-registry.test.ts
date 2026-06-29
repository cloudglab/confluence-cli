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

  it("attaches rich recommendations metadata to high-frequency commands", async () => {
    const contentRegistry = new InMemoryCliRegistry();
    const attachmentRegistry = new InMemoryCliRegistry();
    const transferRegistry = new InMemoryCliRegistry();
    const writeRegistry = new InMemoryCliRegistry();
    const restRegistry = new InMemoryCliRegistry();

    await registerTools(contentRegistry, "full", { commandName: "getPageSnapshot" });
    await registerTools(attachmentRegistry, "full", { commandName: "listAttachments" });
    await registerTools(transferRegistry, "full", { commandName: "uploadMarkdown" });
    await registerTools(writeRegistry, "full", { commandName: "addComment" });
    await registerTools(restRegistry, "full", { commandName: "callRestApi" });

    const snapshot = contentRegistry.get("getPageSnapshot");
    const attachments = attachmentRegistry.get("listAttachments");
    const uploadMarkdown = transferRegistry.get("uploadMarkdown");
    const addComment = writeRegistry.get("addComment");
    const callRestApi = restRegistry.get("callRestApi");
    expect(snapshot?.metadata?.recommendations?.[0]).toMatchObject({
      tool: "getContent",
      args: { id: { source: "input", path: "id" } },
    });
    expect(attachments?.metadata?.recommendations?.[0]).toMatchObject({
      tool: "downloadAttachment",
      args: {
        id: { source: "input", path: "id" },
        attachmentId: { source: "payload", path: "results.0.id" },
      },
    });
    expect(uploadMarkdown?.metadata?.recommendations?.[0]).toMatchObject({
      tool: "getContent",
      args: { id: { source: "payload", path: "page.id" } },
    });
    expect(addComment?.metadata?.recommendations?.[0]).toMatchObject({
      tool: "getComments",
      args: { id: { source: "input", path: "id" } },
    });
    expect(callRestApi?.metadata?.recommendations?.[0]).toMatchObject({
      tool: "getContent",
      args: { id: { source: "input", path: "pathParams.id" } },
    });
  });
});
