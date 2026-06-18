import type { Delete, Emphasis, Strong } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<Strong>("strong", (node, _context, convertChildren) => `<strong>${convertChildren(node)}</strong>`);
registerConverter<Emphasis>("emphasis", (node, _context, convertChildren) => `<em>${convertChildren(node)}</em>`);
registerConverter<Delete>("delete", (node, _context, convertChildren) => `<del>${convertChildren(node)}</del>`);
