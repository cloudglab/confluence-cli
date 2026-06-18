import type { Blockquote, Paragraph, Text } from "mdast";
import { registerConverter } from "../registry.js";
import { macro } from "../utils.js";

const ADMONITION_REGEX = /^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]\s*/i;

registerConverter<Blockquote>("blockquote", (node, _context, convertChildren) => {
  const firstChild = node.children[0];
  if (firstChild?.type === "paragraph") {
    const firstText = (firstChild as Paragraph).children[0];
    if (firstText?.type === "text") {
      const match = (firstText as Text).value.match(ADMONITION_REGEX);
      if (match) {
        const type = match[1].toUpperCase();
        const modifiedNode = {
          ...node,
          children: [
            {
              ...firstChild,
              children: [
                {
                  ...firstText,
                  value: (firstText as Text).value.replace(ADMONITION_REGEX, ""),
                },
                ...(firstChild as Paragraph).children.slice(1),
              ],
            },
            ...node.children.slice(1),
          ],
        };
        return macro(getAdmonitionMacro(type), {}, convertChildren(modifiedNode as Blockquote));
      }
    }
  }

  return `<blockquote>${convertChildren(node)}</blockquote>`;
});

function getAdmonitionMacro(type: string): string {
  switch (type) {
    case "NOTE":
      return "info";
    case "WARNING":
    case "CAUTION":
      return "warning";
    case "TIP":
      return "tip";
    case "IMPORTANT":
      return "note";
    default:
      return "info";
  }
}
