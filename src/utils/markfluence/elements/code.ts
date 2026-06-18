import type { Code, InlineCode } from "mdast";
import { registerConverter } from "../registry.js";
import { buildCodeMacro, escapeXml } from "../utils.js";

registerConverter<InlineCode>("inlineCode", (node) => `<code>${escapeXml(node.value)}</code>`);

registerConverter<Code>("code", (node, context) => {
  const lang = node.lang || "";
  const code = node.value;

  if (lang === "mermaid") {
    if (context.config.mermaid === false) {
      return buildCodeMacro("text", code);
    }

    const attachment = context.attachments.get(code);
    if (attachment) {
      return `<ac:image ac:align="center" ac:layout="center" ac:width="800" ac:thumbnail="true"><ri:attachment ri:filename="${escapeXml(attachment.filename)}"/></ac:image>`;
    }
  }

  return buildCodeMacro(lang || undefined, code);
});
