import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";
import { renderCommandHelp } from "../../src/core/cli-output.js";

describe("renderCommandHelp 参数描述", () => {
  it("把 .optional() / .default() 参数正确标成 optional 并显示默认值", () => {
    const registry = new InMemoryCliRegistry();
    const handler = vi.fn(() => ({ content: [{ type: "text" as const, text: "{}" }] }));

    registry.tool(
      "uploadMarkdown",
      {
        file: z.string(),
        id: z.coerce.string().optional(),
        confirm: z.boolean().default(false),
        toc: z.boolean().default(false),
        tocMaxLevel: z.coerce.number().min(1).max(7).optional(),
      },
      handler,
      "Upload Markdown as Confluence page",
    );

    const help = renderCommandHelp(registry, "uploadMarkdown");
    const paramLine = (flag: string): string => {
      const line = help.split("\n").find((entry) => entry.trimStart().startsWith(`--${flag} `));
      if (!line) throw new Error(`missing param line for --${flag}\n${help}`);
      return line.trimStart();
    };

    // --confirm 是 .default(false):应标 optional,并显示 default=false
    // (原 bug:unwrapShapeSchema 剥掉 ZodDefault 后,内层 schema.isOptional() 恒为 false,
    //  且拿不到 defaultValue,导致 --confirm 被误报成 required 且无默认值)
    const confirmLine = paramLine("confirm");
    expect(confirmLine).toContain("optional");
    expect(confirmLine).toContain("default=false");

    // --file 是必填:应标 required 且无 default
    const fileLine = paramLine("file");
    expect(fileLine).toContain("required");
    expect(fileLine).not.toContain("default=");

    // --id 是 .optional():应标 optional 且无 default
    const idLine = paramLine("id");
    expect(idLine).toContain("optional");
    expect(idLine).not.toContain("default=");

    // --tocMaxLevel 是 .optional():应标 optional 且无 default
    const tocMaxLine = paramLine("tocMaxLevel");
    expect(tocMaxLine).toContain("optional");
    expect(tocMaxLine).not.toContain("default=");
  });

  it("渲染命令头与描述", () => {
    const registry = new InMemoryCliRegistry();
    const handler = vi.fn(() => ({ content: [{ type: "text" as const, text: "{}" }] }));
    registry.tool("ping", { id: z.string() }, handler, "ping a page");

    const help = renderCommandHelp(registry, "ping");
    expect(help.split("\n")[0]).toBe("confluence ping [--key value]");
    expect(help).toContain("ping a page");
  });
});
