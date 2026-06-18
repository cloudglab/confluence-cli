import type { Paragraph } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<Paragraph>("paragraph", (node, _context, convertChildren) => `<p>${convertChildren(node)}</p>`);
