import type { Image } from "mdast";
import { registerConverter } from "../registry.js";
import { buildStorageImage } from "../utils.js";

registerConverter<Image>("image", (node) => buildStorageImage(node.url, node.alt || "", node.title));
