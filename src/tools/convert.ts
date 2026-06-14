import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { z } from "zod";
import { convert as convertDiagram } from "@whitebite/diagram-converter";
import type { CliRegistry } from "../core/cli-registry.js";
import { markdownToWiki, parseMarkdown } from "../utils/markdown.js";
import { jsonResult, textResult } from "../utils/result.js";

export function registerConvertTools(registry: CliRegistry): void {
  registry.tool(
    "convertMarkdownToWiki",
    z.object({ file: z.string().optional(), text: z.string().optional() }).refine((input) => input.file || input.text, "Provide file or text"),
    ({ file, text }) => textResult(markdownToWiki(text ?? readFileSync(file!, "utf8"))),
    "Convert Markdown to Confluence Wiki Markup",
  );

  registry.tool(
    "convertMermaidToDrawio",
    z
      .object({
        file: z.string().optional(),
        text: z.string().optional(),
        output: z.string().optional(),
        mode: z.enum(["auto", "mermaid", "markdown"]).default("auto"),
      })
      .refine((input) => input.file || input.text, "Provide file or text"),
    (input) => {
      const sourceText = input.text ?? readFileSync(input.file!, "utf8");
      const mermaid = extractMermaidSource(sourceText, input.mode ?? "auto", input.file);
      const converted = convertDiagram(mermaid, { from: "mermaid", to: "drawio", layout: { algorithm: "dagre" } });
      const drawioXml = converted.output;
      const outputPath = resolveOutputPath(input.output, input.file);

      if (outputPath) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, drawioXml, "utf8");
      }

      return jsonResult({
        outputPath,
        bytes: Buffer.byteLength(drawioXml, "utf8"),
        preview: outputPath ? undefined : drawioXml.slice(0, 2000),
        warnings: converted.warnings ?? [],
      });
    },
    "Convert Mermaid to draw.io .drawio file",
  );
}

function extractMermaidSource(content: string, mode: "auto" | "mermaid" | "markdown", file?: string): string {
  if (mode === "mermaid") return content.trim();

  if (mode === "markdown" || isMarkdownFile(file) || /```\s*mermaid\b/i.test(content)) {
    const block = findFirstMermaidBlock(content);
    if (!block) throw new Error("No mermaid fenced block found in markdown content.");
    return block.trim();
  }

  return content.trim();
}

function findFirstMermaidBlock(content: string): string | undefined {
  const match = content.match(/```\s*mermaid\s*\n([\s\S]*?)```/i);
  return match?.[1];
}

function isMarkdownFile(file?: string): boolean {
  if (!file) return false;
  const suffix = extname(file).toLowerCase();
  return suffix === ".md" || suffix === ".markdown" || suffix === ".mdown";
}

function resolveOutputPath(output: string | undefined, file?: string): string | undefined {
  if (output) return output;
  if (!file) return undefined;
  const fileName = basename(file, extname(file));
  return join(dirname(file), `${fileName}.drawio`);
}
