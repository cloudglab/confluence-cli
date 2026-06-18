import type { ThematicBreak } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<ThematicBreak>("thematicBreak", () => "<hr/>");
