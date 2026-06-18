import type { Root } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<Root>("root", (node, _context, convertChildren) => convertChildren(node));
