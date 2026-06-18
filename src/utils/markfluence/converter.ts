import type { Node, Parent } from "mdast";
import { converters, type Converter, registerConverter } from "./registry.js";
import type { ConversionContext } from "./types.js";

export { type Converter, registerConverter };

import "./elements/root.js";
import "./elements/paragraph.js";
import "./elements/heading.js";
import "./elements/text.js";
import "./elements/emphasis.js";
import "./elements/code.js";
import "./elements/list.js";
import "./elements/table.js";
import "./elements/link.js";
import "./elements/image.js";
import "./elements/blockquote.js";
import "./elements/break.js";
import "./elements/thematic-break.js";
import "./elements/html.js";

export function convert(node: Node, context: ConversionContext): string {
  const converter = converters.get(node.type);
  if (!converter) {
    if (context.config.verbose) console.warn(`Unknown node type: ${node.type}`);
    if ("children" in node && Array.isArray(node.children)) return convertChildren(node as Parent, context);
    return "";
  }
  return converter(node, context, (parent) => convertChildren(parent, context));
}

function convertChildren(node: Parent, context: ConversionContext): string {
  return node.children.map((child: Node) => convert(child, context)).join("");
}
