import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { ConfluenceApi, type ConfluenceAttachment, type ConfluenceContent } from "../api/index.js";
import type { CliRegistry } from "../core/cli-registry.js";
import { loadConfluenceConfig } from "../core/config.js";
import { previewOrAssertWriteAllowed } from "../core/write-guard.js";
import type { ConfluenceConfig } from "../types/common.js";
import { markdownToStorage, parseMarkdown, postProcessStorageHtml } from "../utils/markdown.js";
import { jsonResult } from "../utils/result.js";

export function registerTransferTools(registry: CliRegistry): void {
  registry.tool(
    "uploadMarkdown",
    z.object({
      file: z.string(),
      id: z.coerce.string().optional(),
      space: z.string().optional(),
      title: z.string().optional(),
      parentId: z.coerce.string().optional(),
      representation: z.enum(["storage"]).default("storage"),
      attachments: z.array(z.string()).optional(),
      mermaid: z.enum(["png", "svg", "none"]).default("png"),
      forceReupload: z.boolean().default(false),
      confirm: z.boolean().default(false),
      toc: z.boolean().default(false),
      tocMaxLevel: z.coerce.number().min(1).max(7).optional(),
    }),
    async (input) => {
      const representation = input.representation ?? "storage";
      const raw = readFileSync(input.file, "utf8");
      const parsed = parseMarkdown(raw, basename(input.file, extname(input.file)));
      const title = input.title ?? parsed.title;
      if (!title) throw new Error("Missing page title. Provide --title or an H1/frontmatter title.");
      const prepared = prepareMarkdownForUpload(parsed.body, title, input.file, representation, input.mermaid ?? "png");
      const effectiveRepresentation = prepared.generatedFiles.length > 0 ? "storage" : representation;
      const attachments = [...prepared.generatedFiles.map((item) => item.filePath), ...(input.attachments ?? [])];
      const body = input.toc ? buildTocMacro(input.tocMaxLevel) + "\n" + prepared.body : prepared.body;

      const action = input.id ? "updateMarkdownPage" : "createMarkdownPage";
      const preview = previewOrAssertWriteAllowed({ action, confirm: input.confirm, payload: { title, space: input.space, parentId: input.parentId, representation: effectiveRepresentation, attachments, forceReupload: input.forceReupload ?? false, bodyPreview: body.slice(0, 1000), generatedFiles: prepared.generatedFiles.map((item) => item.filePath) } });
      if (preview) return jsonResult(preview);

      const config = loadConfluenceConfig();
      const api = new ConfluenceApi(config);
      let page: ConfluenceContent;
      if (input.id) {
        const current = await api.getContent(input.id, "version,title");
        page = await api.updateContent({ id: input.id, title, body, representation: effectiveRepresentation, version: (current.version?.number ?? 0) + 1, parentId: input.parentId });
      } else {
        if (!input.space) throw new Error("Creating content requires --space.");
        page = await api.createContent({ space: input.space, title, body, representation: effectiveRepresentation, parentId: input.parentId });
      }

      const uploadedAttachments = await uploadAttachmentFiles(api, page.id, attachments, input.forceReupload ?? false);
      const finalBody = applyMermaidImageMacros(body, prepared.generatedFiles, uploadedAttachments);
      if (finalBody !== body) {
        const current = await api.getContent(page.id, "version,title");
        page = await api.updateContent({ id: page.id, title, body: finalBody, representation: "storage", version: (current.version?.number ?? 0) + 1, parentId: input.parentId });
      }
      return jsonResult({ page, attachments: uploadedAttachments, generatedFiles: prepared.generatedFiles.map((item) => item.filePath) });
    },
    "Upload Markdown as Confluence page; writes require confirm=true",
  );

  registry.tool(
    "uploadHtml",
    z.object({
      file: z.string(),
      id: z.coerce.string().optional(),
      space: z.string().optional(),
      title: z.string().optional(),
      parentId: z.coerce.string().optional(),
      attachments: z.array(z.string()).optional(),
      mermaid: z.enum(["png", "svg", "none"]).default("png"),
      forceReupload: z.boolean().default(false),
      confirm: z.boolean().default(false),
      toc: z.boolean().default(false),
      tocMaxLevel: z.coerce.number().min(1).max(7).optional(),
    }),
    async (input) => {
      const raw = readFileSync(input.file, "utf8");
      const title = input.title ?? extractTitleFromHtml(raw) ?? basename(input.file, extname(input.file));
      const prepared = replaceMermaidInHtml(raw, title, input.file, input.mermaid ?? "png");
      const bodyContent = extractBodyContent(prepared.html);
      let body = postProcessStorageHtml(bodyContent);
      if (input.toc) body = buildTocMacro(input.tocMaxLevel) + "\n" + body;
      const attachments = [...prepared.generatedFiles.map((item) => item.filePath), ...(input.attachments ?? [])];

      const action = input.id ? "updateHtmlPage" : "createHtmlPage";
      const preview = previewOrAssertWriteAllowed({ action, confirm: input.confirm, payload: { title, space: input.space, parentId: input.parentId, representation: "storage", attachments, forceReupload: input.forceReupload ?? false, bodyPreview: body.slice(0, 1000), generatedFiles: prepared.generatedFiles.map((item) => item.filePath) } });
      if (preview) return jsonResult(preview);

      const config = loadConfluenceConfig();
      const api = new ConfluenceApi(config);
      let page: ConfluenceContent;
      if (input.id) {
        const current = await api.getContent(input.id, "version,title");
        page = await api.updateContent({ id: input.id, title, body, representation: "storage", version: (current.version?.number ?? 0) + 1, parentId: input.parentId });
      } else {
        if (!input.space) throw new Error("Creating content requires --space.");
        page = await api.createContent({ space: input.space, title, body, representation: "storage", parentId: input.parentId });
      }

      const uploadedAttachments = await uploadAttachmentFiles(api, page.id, attachments, input.forceReupload ?? false);
      const finalBody = applyMermaidImageMacros(body, prepared.generatedFiles, uploadedAttachments);
      if (finalBody !== body) {
        const current = await api.getContent(page.id, "version,title");
        page = await api.updateContent({ id: page.id, title, body: finalBody, representation: "storage", version: (current.version?.number ?? 0) + 1, parentId: input.parentId });
      }
      return jsonResult({ page, attachments: uploadedAttachments, generatedFiles: prepared.generatedFiles.map((item) => item.filePath) });
    },
    "Upload HTML as Confluence page; writes require confirm=true",
  );

  registry.tool(
    "downloadPage",
    z.object({
      id: z.coerce.string(),
      outputDir: z.string().default("."),
      saveHtml: z.boolean().default(false),
      downloadAttachments: z.boolean().default(false),
      downloadChildren: z.boolean().default(false),
    }),
    async ({ id, outputDir, saveHtml, downloadAttachments, downloadChildren }) => {
      const targetDir = outputDir ?? ".";
      const config = loadConfluenceConfig();
      const api = new ConfluenceApi(config);
      mkdirSync(targetDir, { recursive: true });
      return jsonResult(await downloadPageToDir(api, config, id, targetDir, { saveHtml: saveHtml ?? false, downloadAttachments: downloadAttachments ?? false, downloadChildren: downloadChildren ?? false }));
    },
    "Download one page to Markdown with optional attachments and children",
  );
}

interface GeneratedMermaidFile {
  marker: string;
  filePath: string;
  attachmentName: string;
  renderKind: MermaidRenderKind;
}

type MermaidRenderKind = "png" | "svg";
type MermaidMode = MermaidRenderKind | "none";

function prepareMarkdownForUpload(markdown: string, pageTitle: string, sourceFile: string, _representation: "storage", mermaidMode: MermaidMode): { body: string; generatedFiles: GeneratedMermaidFile[] } {
  const prepared = replaceMermaidFences(markdown, pageTitle, sourceFile, mermaidMode);
  const body = markdownToStorage(prepared.markdown);
  return { body, generatedFiles: prepared.generatedFiles };
}

function replaceMermaidFences(markdown: string, pageTitle: string, sourceFile: string, mermaidMode: MermaidMode): { markdown: string; generatedFiles: GeneratedMermaidFile[] } {
  if (mermaidMode === "none") return { markdown, generatedFiles: [] };
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  const generatedFiles: GeneratedMermaidFile[] = [];
  let inMermaid = false;
  let buffer: string[] = [];
  let index = 0;

  for (const line of lines) {
    const fence = line.match(/^```\s*mermaid\s*$/i);
    if (fence) {
      if (!inMermaid) {
        inMermaid = true;
        buffer = [];
      } else {
        const mermaidSource = buffer.join("\n").trim();
        const generated = createMermaidFile(mermaidSource, pageTitle, sourceFile, index, mermaidMode);
        generatedFiles.push(generated);
        output.push(generated.marker);
        index += 1;
        inMermaid = false;
      }
      continue;
    }

    if (inMermaid && /^```\s*$/.test(line)) {
      const mermaidSource = buffer.join("\n").trim();
      const generated = createMermaidFile(mermaidSource, pageTitle, sourceFile, index, mermaidMode);
      generatedFiles.push(generated);
      output.push(generated.marker);
      index += 1;
      inMermaid = false;
      continue;
    }

    if (inMermaid) {
      buffer.push(line);
      continue;
    }

    output.push(line);
  }

  if (inMermaid) throw new Error("Mermaid code fence is not closed.");

  return { markdown: output.join("\n"), generatedFiles };
}

function applyMermaidImageMacros(body: string, generatedFiles: GeneratedMermaidFile[], uploadedAttachments: Array<{ file: string; action: string; result: unknown }>): string {
  let output = body;
  for (let index = 0; index < generatedFiles.length; index += 1) {
    const generated = generatedFiles[index];
    const uploaded = uploadedAttachments[index];
    const attachment = readUploadedAttachment(uploaded?.result, generated.attachmentName);
    const filename = attachment?.title ?? generated.attachmentName;
    const macro = buildImageMacro(filename);
    output = output.replaceAll(`<p>${generated.marker}</p>`, macro).replaceAll(generated.marker, macro);
  }
  return output;
}

function buildImageMacro(filename: string): string {
  return `<ac:image><ri:attachment ri:filename="${escapeXml(filename)}" /></ac:image>`;
}

interface UploadedAttachment {
  id: string;
  title?: string;
  version?: { number?: number };
}

function readUploadedAttachment(value: unknown, expectedTitle?: string): UploadedAttachment | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  if ("results" in value && Array.isArray((value as { results?: unknown }).results)) {
    const list = (value as { results?: UploadedAttachment[] }).results ?? [];
    if (expectedTitle) {
      const matched = list.find((entry) => entry?.title === expectedTitle);
      if (matched) return matched;
    }
    return list[0];
  }
  if ("id" in value) return value as UploadedAttachment;
  return undefined;
}

function buildTocMacro(maxLevel?: number): string {
  const macros = ['<ac:structured-macro ac:name="toc" ac:schema-version="1">'];
  if (maxLevel !== undefined && maxLevel >= 1 && maxLevel <= 7) {
    macros.push(`<ac:parameter ac:name="maxLevel">${maxLevel}</ac:parameter>`);
  }
  macros.push("</ac:structured-macro>");
  macros.push('<ac:structured-macro ac:name="easy-heading-free" ac:schema-version="1" />');
  return macros.join("");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

async function uploadAttachmentFiles(api: ConfluenceApi, pageId: string, files: string[], forceReupload: boolean): Promise<Array<{ file: string; action: string; result: unknown }>> {
  if (files.length === 0) return [];
  const existing = forceReupload ? await api.listAttachments(pageId, 100) : undefined;
  const results: Array<{ file: string; action: string; result: unknown }> = [];
  for (const file of files) {
    const filename = basename(file);
    const matched = existing?.results.find((attachment) => attachment.title === filename);
    const contentType = attachmentContentType(filename);
    if (matched) {
      results.push({ file, action: "updateAttachment", result: await api.updateAttachmentData({ pageId, attachmentId: matched.id, filename, data: readFileSync(file), minorEdit: true, contentType }) });
    } else {
      results.push({ file, action: "uploadAttachment", result: await api.uploadAttachment({ pageId, filename, data: readFileSync(file), minorEdit: true, contentType }) });
    }
  }
  return results;
}

function attachmentContentType(filename: string): string | undefined {
  const extension = extname(filename).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".svg") return "image/svg+xml";
  return undefined;
}

async function downloadPageToDir(
  api: ConfluenceApi,
  config: ConfluenceConfig,
  id: string,
  targetDir: string,
  options: { saveHtml: boolean; downloadAttachments: boolean; downloadChildren: boolean },
): Promise<{ page: { id: string; title: string }; markdownPath: string; htmlPath?: string; attachmentPaths: string[]; children: unknown[] }> {
  const page = await api.getContent(id, "body.storage,version,space,ancestors,metadata.labels");
  const safeTitle = safeFileName(page.title);
  const body = page.body?.storage?.value ?? "";
  const markdownPath = join(targetDir, `${safeTitle}.md`);
  const htmlPath = options.saveHtml ? join(targetDir, `${safeTitle}.html`) : undefined;
  writeFileSync(markdownPath, markdownForPage(config, page, body));
  if (htmlPath) writeFileSync(htmlPath, body);

  const attachmentPaths = options.downloadAttachments ? await downloadPageAttachments(api, page.id, join(targetDir, `${safeTitle}_attachments`)) : [];
  const children = options.downloadChildren ? await downloadChildren(api, config, page.id, join(targetDir, `${safeTitle}_Children`), options) : [];
  return { page: { id: page.id, title: page.title }, markdownPath, htmlPath, attachmentPaths, children };
}

async function downloadPageAttachments(api: ConfluenceApi, pageId: string, targetDir: string): Promise<string[]> {
  const attachments = await api.listAttachments(pageId, 100);
  if (attachments.results.length === 0) return [];
  mkdirSync(targetDir, { recursive: true });
  const paths: string[] = [];
  for (const attachment of attachments.results) {
    const outputPath = await downloadAttachment(api, attachment, targetDir);
    if (outputPath) paths.push(outputPath);
  }
  return paths;
}

async function downloadAttachment(api: ConfluenceApi, attachment: ConfluenceAttachment, targetDir: string): Promise<string | undefined> {
  if (!attachment._links?.download) return undefined;
  const outputPath = join(targetDir, safeFileName(attachment.title));
  const downloaded = await api.downloadAttachment(attachment._links.download);
  writeFileSync(outputPath, downloaded.data);
  return outputPath;
}

async function downloadChildren(api: ConfluenceApi, config: ConfluenceConfig, pageId: string, targetDir: string, options: { saveHtml: boolean; downloadAttachments: boolean; downloadChildren: boolean }): Promise<unknown[]> {
  const children = await api.getChildren(pageId, "page", "body.storage,version,space", 100);
  if (children.results.length === 0) return [];
  mkdirSync(targetDir, { recursive: true });
  const childOptions = { ...options, downloadChildren: false };
  const results: unknown[] = [];
  for (const child of children.results) {
    results.push(await downloadPageToDir(api, config, child.id, targetDir, childOptions));
  }
  return results;
}

function markdownForPage(config: ConfluenceConfig, page: ConfluenceContent, body: string): string {
  return [
    "---",
    `title: ${JSON.stringify(page.title)}`,
    `confluence_url: ${JSON.stringify(`${config.url}/pages/viewpage.action?pageId=${page.id}`)}`,
    `id: ${page.id}`,
    `space: ${page.space?.key ?? ""}`,
    `version: ${page.version?.number ?? ""}`,
    "---",
    "",
    htmlToPlainMarkdown(body),
  ].join("\n");
}

function htmlToPlainMarkdown(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gis, (_match, level: string, text: string) => `${"#".repeat(Number(level))} ${stripTags(text)}\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

function extractTitleFromHtml(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  return undefined;
}

function replaceMermaidInHtml(html: string, pageTitle: string, sourceFile: string, mermaidMode: MermaidMode): { html: string; generatedFiles: GeneratedMermaidFile[] } {
  if (mermaidMode === "none") return { html, generatedFiles: [] };
  const generatedFiles: GeneratedMermaidFile[] = [];
  let index = 0;
  let output = html;

  // 1) Handle HTML-style mermaid blocks: <pre><code class="language-mermaid">...</code></pre>
  output = output.replace(/<pre><code\s+class="language-mermaid"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_match, mermaidSource: string) => {
    const source = mermaidSource.trim();
    if (!source) return _match;
    const gf = createMermaidFile(source, pageTitle, sourceFile, index, mermaidMode);
    generatedFiles.push(gf);
    index += 1;
    return gf.marker;
  });

  // 2) Handle markdown-style fences in HTML source: ```mermaid ... ```
  const lines = output.split(/\r?\n/);
  const outLines: string[] = [];
  let inMermaid = false;
  let buffer: string[] = [];

  for (const line of lines) {
    const fence = line.match(/^```\s*mermaid\s*$/i);
    if (fence && !inMermaid) {
      inMermaid = true;
      buffer = [];
      continue;
    }
    if (inMermaid && /^```\s*$/.test(line)) {
      const source = buffer.join("\n").trim();
      if (source) {
        const gf = createMermaidFile(source, pageTitle, sourceFile, index, mermaidMode);
        generatedFiles.push(gf);
        index += 1;
        outLines.push(gf.marker);
      }
      inMermaid = false;
      continue;
    }
    if (inMermaid) {
      buffer.push(line);
      continue;
    }
    outLines.push(line);
  }

  return { html: outLines.join("\n"), generatedFiles };
}

function createMermaidFile(mermaidSource: string, pageTitle: string, sourceFile: string, idx: number, renderKind: MermaidRenderKind): GeneratedMermaidFile {
  const attachmentName = `${safeFileName(pageTitle || basename(sourceFile, extname(sourceFile)))}-mermaid-${idx + 1}.${renderKind}`;
  const marker = `MERMAID_IMAGE_PLACEHOLDER_${idx}`;
  const outputDir = join(tmpdir(), "confluence-cli");
  mkdirSync(outputDir, { recursive: true });
  const filePath = join(outputDir, attachmentName);
  renderMermaidFile(mermaidSource, filePath, renderKind);
  return { marker, filePath, attachmentName, renderKind };
}

function renderMermaidFile(mermaidSource: string, outputFile: string, renderKind: MermaidRenderKind): void {
  if (/^%%\{init:/m.test(mermaidSource)) {
    throw new Error(
      "Failed to render Mermaid with beautiful-mermaid-cli: detected %%{init:...}%% header. 当前内置渲染器不支持该主题配置；请先用 mmdc 单独渲染成图片后在 Markdown/HTML 中引用，或去掉 init 头。",
    );
  }
  const inputFile = join(dirname(outputFile), `${basename(outputFile, extname(outputFile))}.mmd`);
  writeFileSync(inputFile, mermaidSource, "utf8");
  const renderer = resolveBeautifulMermaidBin();
  const args = ["render", inputFile, "-o", outputFile, "--json"];
  if (renderKind === "png") {
    args.push("--scale", "3");
  }
  try {
    execFileSync(renderer, args, { stdio: "pipe" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render Mermaid as ${renderKind} with beautiful-mermaid-cli: ${message}`);
  }
}

function resolveBeautifulMermaidBin(): string {
  const extension = process.platform === "win32" ? ".cmd" : "";
  const candidates = [
    join(process.env.HOME ?? "", ".npm-global", "bin", `bm${extension}`),
    join(process.env.HOME ?? "", ".local", "bin", `bm${extension}`),
    `/usr/local/bin/bm${extension}`,
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;
  return `bm${extension}`;
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
