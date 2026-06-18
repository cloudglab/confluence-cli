import type { Heading } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<Heading>("heading", (node, _context, convertChildren) => {
  const level = Math.min(Math.max(node.depth, 1), 6);
  return `<h${level}>${convertChildren(node)}</h${level}>`;
});
