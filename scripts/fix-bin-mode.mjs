import { chmod } from "node:fs/promises";
import path from "node:path";

const binFiles = ["confluence.js", "confluence-reader.js", "confluence-writer.js"];

await Promise.all(
  binFiles.map((file) => chmod(path.join("dist", "bin", file), 0o755)),
);
