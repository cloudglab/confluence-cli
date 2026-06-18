import type { Link } from "mdast";
import { registerConverter } from "../registry.js";
import { escapeAttr } from "../utils.js";

registerConverter<Link>("link", (node, _context, convertChildren) => {
  const url = node.url;
  const title = node.title;
  const text = convertChildren(node);

  if (url.startsWith("#")) {
    return `<ac:link ac:anchor="${escapeAttr(url.slice(1))}"><ac:link-body>${text}</ac:link-body></ac:link>`;
  }

  const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
  return `<a href="${escapeAttr(url)}"${titleAttr}>${text}</a>`;
});
