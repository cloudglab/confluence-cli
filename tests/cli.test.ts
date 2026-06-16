import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(async (file) => {
      const fileName = String(file);
      if (fileName.includes("CHANGELOG.md")) {
        return "# Changelog\n\n## 0.0.1 - 2026-06-15\n\n- 初始版本\n";
      }
      return JSON.stringify({
        version: "0.0.1",
        commands: [
          "initConfluence",
          "searchContent",
          "getContent",
          "uploadMarkdown",
          "downloadPage",
          "install",
          "update",
          "uninstall",
          "remove"
        ],
        groups: {
          init: ["initConfluence"],
          content: ["searchContent", "getContent"],
          transfer: ["uploadMarkdown", "downloadPage"],
          install: ["install", "update", "uninstall", "remove"]
        },
        commandToGroup: {
          initConfluence: "init",
          searchContent: "content",
          getContent: "content",
          uploadMarkdown: "transfer",
          downloadPage: "transfer",
          install: "install",
          update: "install",
          uninstall: "install",
          remove: "install"
        }
      });
    }),
  };
});

describe("runCli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints top-level help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["help"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "");
    expect(output).toContain("confluence CLI 0.0.4");
    expect(output).toContain("confluence [--role full|reader|writer] <command> [--key value]");
    expect(output).toContain("写操作保护");
  });

  it("prints command help through help command", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["help", "update"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence update"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("npx -y @cloudglab/confluence-cli@latest update"));
  });

  it("supports direct command help flag without validating args", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["uploadMarkdown", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence uploadMarkdown [--key value]"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("--confirm boolean"));
  });

  it("supports inline role syntax", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["--role=reader", "list"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "");
    expect(output).toContain("confluence 可用命令");
    expect(output).toContain("内容检索 / 页面");
    expect(output).toContain("searchContent");
    expect(output).not.toContain("uploadMarkdown");
  });

  it("supports raw list output", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["list", "--raw"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "");
    expect(output).toContain("changelog\n");
    expect(output).toContain("searchContent\n");
    expect(output).not.toContain("confluence 可用命令");
  });

  it("supports builtin changelog command", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["changelog", "--limit", "1"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "");
    expect(output).toContain("confluence CLI 最近更新");
    expect(output).toContain("## 0.0.1 - 2026-06-15");
  });

  it("prints builtin changelog help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["changelog", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence changelog [--limit N|all]"));
  });

  it("prints builtin install help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["install", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence install"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("npx -y @cloudglab/confluence-cli@latest install"));
  });

  it("prints builtin update help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["update", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence update"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("npx -y @cloudglab/confluence-cli@latest update"));
  });

  it("prints builtin upgrade help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["upgrade", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence update"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("npx -y @cloudglab/confluence-cli@latest update"));
  });

  it("prints builtin uninstall help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["uninstall", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence uninstall"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("npx -y @cloudglab/confluence-cli@latest uninstall --confirm true"));
  });

  it("prints builtin remove help", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["remove", "--help"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence uninstall"));
  });

  it("supports help lookup with targeted registry build", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["help", "searchContent"]);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence searchContent [--key value]"));
  });
});
