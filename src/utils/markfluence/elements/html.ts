import type { Html } from "mdast";
import { registerConverter } from "../registry.js";
import { postProcessStorageHtml } from "../utils.js";

registerConverter<Html>("html", (node) => postProcessStorageHtml(node.value));
