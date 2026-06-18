import path from "node:path";
import type { Node, Root, Yaml } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { frontmatter as frontmatterExtension } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { parse as parseYaml } from "yaml";
import type { Frontmatter, ParsedDocument } from "./types.js";

export function parse(markdown: string, filename?: string): ParsedDocument {
  const ast = fromMarkdown(markdown, {
    extensions: [gfm(), frontmatterExtension(["yaml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml"])],
  });

  const { frontmatter, cleanedAst } = extractFrontmatter(ast);
  const title = deriveTitle(frontmatter, cleanedAst, filename);

  return { frontmatter, ast: cleanedAst, title };
}

function extractFrontmatter(ast: Root): { frontmatter: Frontmatter; cleanedAst: Root } {
  let frontmatter: Frontmatter = {};
  const children = ast.children.filter((node: Node) => {
    if (node.type === "yaml") {
      try {
        frontmatter = (parseYaml((node as Yaml).value) as Frontmatter) || {};
      } catch {
      }
      return false;
    }
    return true;
  });

  return { frontmatter, cleanedAst: { ...ast, children } };
}

function deriveTitle(frontmatter: Frontmatter, ast: Root, filename?: string): string {
  if (frontmatter.title) return frontmatter.title;
  for (const node of ast.children) {
    if (node.type === "heading" && node.depth === 1) return extractText(node);
  }
  if (filename) return path.basename(filename, path.extname(filename));
  return "Untitled";
}

function extractText(node: Node): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) return node.children.map(extractText).join("");
  return "";
}
