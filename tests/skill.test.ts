import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SKILL_MD_PATH = resolve(process.cwd(), "skills/confluence-cli/SKILL.md");

function readSkill(): string {
  return readFileSync(SKILL_MD_PATH, "utf8");
}

describe("SKILL.md frontmatter", () => {
  it("starts with YAML frontmatter", () => {
    const text = readSkill();
    expect(text.startsWith("---\n")).toBe(true);
  });

  it("declares name matching the skill folder", () => {
    const text = readSkill();
    expect(text).toMatch(/^name:\s*confluence-cli\s*$/m);
  });

  it("declares a non-empty description", () => {
    const text = readSkill();
    const match = text.match(/^description:\s*(\S.*)$/m);
    expect(match).not.toBeNull();
    if (match) {
      const value = match[1]?.trim() ?? "";
      expect(value.length).toBeGreaterThan(20);
    }
  });

  it("contains a markdown body after the frontmatter", () => {
    const text = readSkill();
    const end = text.indexOf("\n---\n", 4);
    expect(end).toBeGreaterThan(4);
    const body = text.slice(end + 5).trim();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/^#\s/m);
  });
});
