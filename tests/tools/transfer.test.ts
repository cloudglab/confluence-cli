import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";

describe("transfer tools", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("uses beautiful-mermaid-cli to render Mermaid png during upload preview", async () => {
    const execFileSync = vi.fn();
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const existsSync = vi.fn((filePath: string) => filePath.endsWith("/bm"));
    const readFileSync = vi.fn((filePath: string) => {
      if (filePath === "/tmp/demo.md") {
        return "# Demo\n\n```mermaid\ngraph TD\n  A-->B\n```\n";
      }
      return "";
    });

    vi.doMock("node:child_process", () => ({ execFileSync }));
    vi.doMock("node:fs", () => ({ existsSync, mkdirSync, readFileSync, writeFileSync }));
    vi.doMock("node:os", () => ({ tmpdir: () => "/tmp" }));
    vi.doMock("../../src/core/config.js", () => ({ loadConfluenceConfig: vi.fn(() => ({ url: "https://confluence.example.com" })) }));

    const { registerTransferTools } = await import("../../src/tools/transfer.js");
    const registry = new InMemoryCliRegistry();
    registerTransferTools(registry);

    const result = await registry.get("uploadMarkdown")!.handler({
      file: "/tmp/demo.md",
      space: "DEV",
      mermaid: "png",
      confirm: false,
    });

    const output = JSON.parse(result.content[0]!.text) as { preview: boolean; payload: { generatedFiles: string[]; representation: string } };

    expect(output.preview).toBe(true);
    expect(output.payload.representation).toBe("storage");
    expect(output.payload.generatedFiles).toHaveLength(1);
    expect(writeFileSync).toHaveBeenCalledWith("/tmp/confluence-cli/Demo-mermaid-1.mmd", "graph TD\n  A-->B", "utf8");
    expect(execFileSync).toHaveBeenCalledWith(
      expect.stringContaining("bm"),
      ["render", "/tmp/confluence-cli/Demo-mermaid-1.mmd", "-o", "/tmp/confluence-cli/Demo-mermaid-1.png", "--json", "--scale", "3"],
      { stdio: "pipe" },
    );
  });

  it("fails fast with guidance when Mermaid init header is present", async () => {
    const execFileSync = vi.fn();
    const writeFileSync = vi.fn();
    const mkdirSync = vi.fn();
    const existsSync = vi.fn((filePath: string) => filePath.endsWith("/bm"));
    const readFileSync = vi.fn((filePath: string) => {
      if (filePath === "/tmp/demo.md") {
        return "# Demo\n\n```mermaid\n%%{init: {'theme':'dark'}}%%\ngraph TD\n  A-->B\n```\n";
      }
      return "";
    });

    vi.doMock("node:child_process", () => ({ execFileSync }));
    vi.doMock("node:fs", () => ({ existsSync, mkdirSync, readFileSync, writeFileSync }));
    vi.doMock("node:os", () => ({ tmpdir: () => "/tmp" }));
    vi.doMock("../../src/core/config.js", () => ({ loadConfluenceConfig: vi.fn(() => ({ url: "https://confluence.example.com" })) }));

    const { registerTransferTools } = await import("../../src/tools/transfer.js");
    const registry = new InMemoryCliRegistry();
    registerTransferTools(registry);

    await expect(
      registry.get("uploadMarkdown")!.handler({
        file: "/tmp/demo.md",
        space: "DEV",
        mermaid: "png",
        confirm: false,
      }),
    ).rejects.toThrow("当前内置渲染器不支持该主题配置");
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
