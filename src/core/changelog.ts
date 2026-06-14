import { readFile } from "node:fs/promises";

export interface ChangelogSection {
  version: string;
  date: string;
  content: string;
}

const VERSION_HEADING_REGEX = /^##\s+(\d+\.\d+\.\d+)\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/;

export async function loadChangelogRaw(): Promise<string> {
  const changelogUrl = new URL("../../CHANGELOG.md", import.meta.url);

  try {
    return await readFile(changelogUrl, "utf8");
  } catch {
    throw new Error("未找到 CHANGELOG.md");
  }
}

export async function loadChangelogSections(): Promise<ChangelogSection[]> {
  const text = await loadChangelogRaw();
  const sections: ChangelogSection[] = [];
  const lines = text.split("\n");
  let current: { version: string; date: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(VERSION_HEADING_REGEX);
    if (match) {
      if (current) {
        sections.push({
          version: current.version,
          date: current.date,
          content: current.lines.join("\n").trimEnd(),
        });
      }
      current = { version: match[1], date: match[2], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    sections.push({
      version: current.version,
      date: current.date,
      content: current.lines.join("\n").trimEnd(),
    });
  }

  return sections;
}
