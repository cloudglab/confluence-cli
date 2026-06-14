import { marked } from "marked";

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
  const html = marked.parse(markdown, { gfm: true, breaks: false }) as string;
  return postProcessStorageHtml(html);
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function postProcessStorageHtml(html: string): string {
  return html
    .replace(/<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_match, language: string | undefined, code: string) => buildCodeMacro(language, decodeHtml(code)))
    .replace(/<ul>\s*((?:<li><input(?: checked="")? disabled="" type="checkbox">\s*[\s\S]*?<\/li>\s*)+)\s*<\/ul>/g, (_match, items: string) => buildTaskList(items))
    .replace(/<img\s+([^>]*?)\s*\/?>(?!<\/img>)/g, (_match, attrs: string) => buildImageMacro(attrs))
    .replace(/<hr>/g, "<hr />")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>(MERMAID_DRAWIO_PLACEHOLDER_\d+)<\/p>/g, "<p>$1</p>");
}

function buildCodeMacro(language: string | undefined, code: string): string {
  const lang = normalizeCodeMacroLanguage(language);
  const params = ["<ac:structured-macro ac:name=\"code\" ac:schema-version=\"1\" data-layout=\"default\">"];
  if (lang) params.push(`<ac:parameter ac:name=\"language\">${escapeXml(lang)}</ac:parameter>`);
  params.push(`<ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>`);
  params.push("</ac:structured-macro>");
  return params.join("");
}

function normalizeCodeMacroLanguage(language: string | undefined): string | undefined {
  const value = language?.trim().toLowerCase();
  if (!value) return undefined;

  const aliases: Record<string, string> = {
    js: "js",
    jsx: "js",
    ts: "js",
    tsx: "js",
    shell: "bash",
    sh: "bash",
    zsh: "bash",
    yml: "yml",
    yaml: "yml",
    xml: "xml",
    html: "xml",
    md: "text",
    markdown: "text",
    json: "text",
    jsonc: "text",
    csharp: "c#",
    python: "py",
  };

  const normalized = aliases[value] ?? value;
  const supported = new Set([
    "actionscript3",
    "applescript",
    "bash",
    "c",
    "c#",
    "coldfusion",
    "cpp",
    "css",
    "delphi",
    "diff",
    "erl",
    "groovy",
    "java",
    "jfx",
    "js",
    "perl",
    "php",
    "powershell",
    "py",
    "ruby",
    "sass",
    "scala",
    "sql",
    "text",
    "vb",
    "xml",
    "yml",
  ]);

  return supported.has(normalized) ? normalized : undefined;
}

function buildTaskList(items: string): string {
  const taskItems: string[] = [];
  const itemRegex = /<li><input(?: checked="")? disabled="" type="checkbox">\s*([\s\S]*?)<\/li>/g;
  let match = itemRegex.exec(items);
  while (match) {
    const complete = /checked=""/i.test(match[0]);
    taskItems.push(
      `<ac:task><ac:task-status>${complete ? "complete" : "incomplete"}</ac:task-status><ac:task-body>${match[1]}</ac:task-body></ac:task>`,
    );
    match = itemRegex.exec(items);
  }
  return taskItems.length > 0 ? `<ac:task-list>${taskItems.join("")}</ac:task-list>` : `<ul>${items}</ul>`;
}

function buildImageMacro(attrs: string): string {
  const src = attrs.match(/src="([^"]+)"/i)?.[1];
  const alt = attrs.match(/alt="([^"]*)"/i)?.[1] ?? "";
  if (!src) return `<img ${attrs} />`;
  return `<ac:image>${src.startsWith("http") ? `<ri:url ri:value="${escapeXml(src)}" />` : `<ri:attachment ri:filename="${escapeXml(src)}" />`}${alt ? `<ac:parameter ac:name="alt">${escapeXml(alt)}</ac:parameter>` : ""}</ac:image>`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}
