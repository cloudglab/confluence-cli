import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";
import { registerMetadataTools } from "../../src/tools/metadata.js";

let tempDir: string | undefined;

describe("generateMarkMetadata", () => {
  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it("generates mark metadata without changing the source file", async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "confluence-metadata-"));
    const file = path.join(tempDir, "guide.md");
    writeFileSync(file, "# Guide\n\nBody");
    const registry = new InMemoryCliRegistry();
    registerMetadataTools(registry);

    const result = await registry.get("generateMarkMetadata")!.handler({ file, space: "DEV", labels: ["api"], write: false });

    expect(result.content[0]?.text).toContain("<!-- Space: DEV -->");
    expect(result.content[0]?.text).toContain("<!-- Title: Guide -->");
    expect(result.content[0]?.text).toContain("<!-- Label: api -->");
    expect(readFileSync(file, "utf8")).toBe("# Guide\n\nBody");
  });

  it("writes metadata and removes old mark metadata", async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "confluence-metadata-"));
    const file = path.join(tempDir, "old.md");
    writeFileSync(file, "<!-- Space: OLD -->\n<!-- Title: Old -->\n# New\n\nBody");
    const registry = new InMemoryCliRegistry();
    registerMetadataTools(registry);

    await registry.get("generateMarkMetadata")!.handler({ file, space: "DEV", title: "New Title", parents: ["Root"], write: true });

    const updated = readFileSync(file, "utf8");
    expect(updated).toContain("<!-- Space: DEV -->");
    expect(updated).toContain("<!-- Title: New Title -->");
    expect(updated).toContain("<!-- Parent: Root -->");
    expect(updated).not.toContain("<!-- Space: OLD -->");
  });
});
