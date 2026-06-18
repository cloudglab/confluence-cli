import type { Text } from "mdast";
import { registerConverter } from "../registry.js";
import { escapeStorageText } from "../utils.js";

registerConverter<Text>("text", (node) => escapeStorageText(node.value));
