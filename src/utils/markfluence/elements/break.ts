import type { Break } from "mdast";
import { registerConverter } from "../registry.js";

registerConverter<Break>("break", () => "<br/>");
