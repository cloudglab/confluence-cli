const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => XML_ENTITIES[char] || char);
}

export function escapeAttr(str: string): string {
  return escapeXml(str);
}

export function macro(name: string, params: Record<string, string> = {}, body?: string): string {
  const paramsXml = Object.entries(params)
    .map(([key, value]) => `<ac:parameter ac:name="${escapeAttr(key)}">${escapeXml(value)}</ac:parameter>`)
    .join("");

  if (body !== undefined) {
    return `<ac:structured-macro ac:name="${escapeAttr(name)}">${paramsXml}<ac:rich-text-body>${body}</ac:rich-text-body></ac:structured-macro>`;
  }

  if (paramsXml) {
    return `<ac:structured-macro ac:name="${escapeAttr(name)}">${paramsXml}</ac:structured-macro>`;
  }

  return `<ac:structured-macro ac:name="${escapeAttr(name)}"/>`;
}

export function plainTextMacro(name: string, params: Record<string, string> = {}, body?: string): string {
  const paramsXml = Object.entries(params)
    .map(([key, value]) => `<ac:parameter ac:name="${escapeAttr(key)}">${escapeXml(value)}</ac:parameter>`)
    .join("");

  if (body !== undefined) {
    return `<ac:structured-macro ac:name="${escapeAttr(name)}">${paramsXml}<ac:plain-text-body><![CDATA[${body}]]></ac:plain-text-body></ac:structured-macro>`;
  }

  return `<ac:structured-macro ac:name="${escapeAttr(name)}">${paramsXml}</ac:structured-macro>`;
}

export function escapeStorageText(value: string): string {
  return escapeXml(value).replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

export function decodeHtml(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function normalizeCodeMacroLanguage(language: string | undefined): string | undefined {
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
  const supported = new Set(["actionscript3", "applescript", "bash", "c", "c#", "coldfusion", "cpp", "css", "delphi", "diff", "erl", "groovy", "java", "jfx", "js", "perl", "php", "powershell", "py", "ruby", "sass", "scala", "sql", "text", "vb", "xml", "yml"]);
  return supported.has(normalized) ? normalized : undefined;
}

export function buildCodeMacro(language: string | undefined, code: string): string {
  const lang = normalizeCodeMacroLanguage(language);
  const params = ["<ac:structured-macro ac:name=\"code\" ac:schema-version=\"1\" data-layout=\"default\">"];
  if (lang) params.push(`<ac:parameter ac:name="language">${escapeXml(lang)}</ac:parameter>`);
  params.push(`<ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>`);
  params.push("</ac:structured-macro>");
  return params.join("");
}

export function buildStorageImage(src: string, alt = "", title?: string | null): string {
  if (!src) return "";
  const resource = src.startsWith("http://") || src.startsWith("https://")
    ? `<ri:url ri:value="${escapeAttr(src)}" />`
    : `<ri:attachment ri:filename="${escapeAttr(src.split("/").pop() || src)}" />`;
  const altAttr = alt ? ` ac:alt="${escapeAttr(alt)}"` : "";
  const titleAttr = title ? ` ac:title="${escapeAttr(title)}"` : "";
  return `<ac:image${altAttr}${titleAttr}>${resource}</ac:image>`;
}

export function postProcessStorageHtml(html: string): string {
  return html
    .replace(/<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_match, language: string | undefined, code: string) => buildCodeMacro(language, decodeHtml(code)))
    .replace(/<ul>\s*((?:<li><input(?: checked="")? disabled="" type="checkbox">\s*[\s\S]*?<\/li>\s*)+)\s*<\/ul>/g, (_match, items: string) => buildTaskList(items))
    .replace(/<img\s+([^>]*?)\s*\/?>((?:<\/img>)?)/g, (_match, attrs: string) => buildImageMacro(attrs))
    .replace(/<hr\s*\/?>/gi, "<hr />")
    .replace(/<br\s*\/?>/gi, "<br />")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>(MERMAID_DRAWIO_PLACEHOLDER_\d+)<\/p>/g, "<p>$1</p>");
}

function buildTaskList(items: string): string {
  const taskItems: string[] = [];
  const itemRegex = /<li><input(?: checked="")? disabled="" type="checkbox">\s*([\s\S]*?)<\/li>/g;
  let match = itemRegex.exec(items);
  while (match) {
    const complete = /checked=""/i.test(match[0]);
    taskItems.push(`<ac:task><ac:task-status>${complete ? "complete" : "incomplete"}</ac:task-status><ac:task-body>${match[1]}</ac:task-body></ac:task>`);
    match = itemRegex.exec(items);
  }
  return taskItems.length > 0 ? `<ac:task-list>${taskItems.join("")}</ac:task-list>` : `<ul>${items}</ul>`;
}

function buildImageMacro(attrs: string): string {
  const src = attrs.match(/src="([^"]+)"/i)?.[1];
  const alt = attrs.match(/alt="([^"]*)"/i)?.[1] ?? "";
  const title = attrs.match(/title="([^"]*)"/i)?.[1] ?? undefined;
  if (!src) return `<img ${attrs} />`;
  return buildStorageImage(src, alt, title);
}
