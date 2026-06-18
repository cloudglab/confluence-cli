import { convert as convertMarkfluenceNode } from "./markfluence/converter.js";
import { parse as parseMarkfluenceDocument } from "./markfluence/parser.js";
import { postProcessStorageHtml as postProcessStorageHtmlInternal } from "./markfluence/utils.js";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  title?: string;
}

export function parseMarkdown(content: string, fallbackTitle?: string): ParsedMarkdown {
  const frontmatter: Record<string, unknown> = {};
  let body = content;

  if (content.startsWith("---\n")) {
    const end = content.indexOf("\n---", 4);
    if (end > 0) {
      Object.assign(frontmatter, parseSimpleYaml(content.slice(4, end)));
      body = content.slice(end + 4).replace(/^\r?\n/, "");
    }
  }

  return { frontmatter, body, title: readTitle(frontmatter, body, fallbackTitle) };
}

export function markdownToWiki(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inCode = false;
  let codeLang = "";

  for (const line of lines) {
    const fence = line.match(/^```\s*([\w-]+)?\s*$/);
    if (fence) {
      if (!inCode) {
        codeLang = fence[1] ?? "";
        output.push(codeLang ? `{code:language=${codeLang}}` : "{code}");
      } else {
        output.push("{code}");
        codeLang = "";
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      output.push(line);
      continue;
    }

    output.push(convertLine(line));
  }

  if (inCode) output.push("{code}");
  return output.join("\n");
}

export function markdownToStorage(markdown: string): string {
  const normalized = normalizeMarkdownForConfluence(markdown);
  const parsed = parseMarkfluenceDocument(normalized);
  return convertMarkfluenceNode(parsed.ast, {
    config: { mermaid: true, verbose: false },
    frontmatter: parsed.frontmatter,
    attachments: new Map(),
  });
}

export function normalizeMarkdownForConfluence(markdown: string): string {
  return escapeCurlyBracesOutsideCode(removeDuplicateMarkdownTableHeaders(markdown));
}

export function postProcessStorageHtml(html: string): string {
  return postProcessStorageHtmlInternal(html);
}

function convertLine(line: string): string {
  const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (heading) {
    const text = heading[2].replace(/\s*\{#[^}]+\}\s*$/, "");
    return `h${heading[1].length}. ${convertInline(text)}`;
  }

  if (/^\s*[-*_]{3,}\s*$/.test(line)) return "----";

  const task = line.match(/^(\s*)[-*]\s+\[([ xX])]\s+(.+)$/);
  if (task) {
    const level = Math.floor(task[1].length / 2) + 1;
    return `${"*".repeat(level)} [${task[2].trim().toLowerCase() === "x" ? "x" : ""}] ${convertInline(task[3])}`;
  }

  const unordered = line.match(/^(\s*)[-*+]\s+(.+)$/);
  if (unordered) {
    const level = Math.floor(unordered[1].length / 2) + 1;
    return `${"*".repeat(level)} ${convertInline(unordered[2])}`;
  }

  const ordered = line.match(/^(\s*)\d+\.\s+(.+)$/);
  if (ordered) {
    const level = Math.floor(ordered[1].length / 2) + 1;
    return `${"#".repeat(level)} ${convertInline(ordered[2])}`;
  }

  const macroQuote = line.match(/^>\s*\*\*(info|tip|note|warning):\*\*\s*(.+)$/i);
  if (macroQuote) return `{${macroQuote[1].toLowerCase()}}\n${convertInline(macroQuote[2])}\n{${macroQuote[1].toLowerCase()}}`;

  const quote = line.match(/^>\s*(.+)$/);
  if (quote) return `bq. ${convertInline(quote[1])}`;

  if (isMarkdownTableSeparator(line)) return "";
  if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
    return line.split("|").slice(1, -1).map((cell) => convertInline(cell.trim())).join(" | ");
  }

  return convertInline(line);
}

function convertInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, (_match, alt: string, url: string) => `!${url}|alt=${alt}!`)
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "[$1|$2]")
    .replace(/`([^`]+)`/g, "{{$1}}")
    .replace(/\*\*([^*]+)\*\*/g, "*$1*")
    .replace(/__([^_]+)__/g, "*$1*")
    .replace(/~~([^~]+)~~/g, "-$1-")
    .replace(/(^|\s)\*([^*\s][^*]*?)\*(?=\s|$)/g, "$1_$2_");
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    result[match[1]] = value;
  }
  return result;
}

function readTitle(frontmatter: Record<string, unknown>, body: string, fallbackTitle?: string): string | undefined {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim()) return frontmatter.title.trim();
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return fallbackTitle;
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function removeDuplicateMarkdownTableHeaders(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (!inFence) {
      const nextLine = lines[index + 1] ?? "";
      if (isDuplicateMarkdownTableHeader(line, nextLine)) continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function isDuplicateMarkdownTableHeader(line: string, nextLine: string): boolean {
  const current = line.trim();
  const next = nextLine.trim();
  if (!current || current !== next) return false;
  if (!current.startsWith("|") || !current.endsWith("|")) return false;
  return !isMarkdownTableSeparator(next);
}

function escapeCurlyBracesOutsideCode(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    output.push(inFence ? line : line.replace(/(?<!\\)\{([^{}\n]+)\}/g, "\\{$1\\}"));
  }

  return output.join("\n");
}
