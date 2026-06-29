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
          "getCurrentUser",
          "whoami",
          "who-am-i",
          "install",
          "update",
          "uninstall",
          "remove"
        ],
        groups: {
          init: ["initConfluence"],
          content: ["searchContent", "getContent"],
          transfer: ["uploadMarkdown", "downloadPage"],
          space: ["getCurrentUser", "whoami", "who-am-i"],
          install: ["install", "update", "uninstall", "remove"]
        },
        commandToGroup: {
          initConfluence: "init",
          searchContent: "content",
          getContent: "content",
          uploadMarkdown: "transfer",
          downloadPage: "transfer",
          getCurrentUser: "space",
          whoami: "space",
          "who-am-i": "space",
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
    expect(output).toMatch(/confluence CLI \d+\.\d+\.\d+/);
    expect(output).toContain("运行要求：Node.js >= 20");
    expect(output).toContain("confluence [--role full|reader|writer] <command> [--key value]");
    expect(output).toContain("confluence whoami");
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
    expect(output).toContain("whoami");
    expect(output).toContain("快速校验账号：confluence whoami");
    expect(output).toContain("内容检索 / 页面");
    expect(output).toContain("searchContent");
    expect(output).not.toContain("uploadMarkdown");
  });

  it("supports raw list output", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["list", "--raw"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "");
    expect(output).toContain("changelog\n");
    expect(output).toContain("whoami\n");
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

  it("normalizes who am i to whoami", async () => {
    vi.resetModules();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const currentUser = { username: "me", displayName: "Demo User" };
    vi.doMock("../src/core/config.js", () => ({
      loadConfluenceConfig: vi.fn(() => ({ apiBaseUrl: "https://confluence.example.com/rest/api", authType: "pat", personalToken: "token" })),
    }));
    vi.doMock("../src/api/index.js", () => ({
      ConfluenceApi: class {
        getCurrentUser = vi.fn(async () => currentUser);
      },
    }));

    const { runCli: runCliWithMocks } = await import("../src/cli.js");
    await runCliWithMocks(["who", "am", "i"]);

    // formatWhoami 现在走 zentao-cli 风格的纯文本渲染(对齐 zentao-cli),
    // 不再输出 JSON。断言关键字段出现在拍平后的多行文本里。
    const lastWrite = String(write.mock.calls.at(-1)?.[0] ?? "");
    expect(lastWrite).toContain("当前 Confluence 账号");
    expect(lastWrite).toContain("显示名：Demo User");
    expect(lastWrite).toContain("用户名：me");
    expect(lastWrite).toContain("快捷入口");
  });

  it("injects meta.next when --recommend is enabled", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["--recommend", "urlParse", "--url", "https://cf.cloudglab.cn/pages/viewpage.action?pageId=5278156"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "").trim();
    const parsed = JSON.parse(output) as { meta?: { next?: Array<Record<string, unknown>> } };
    expect(parsed.meta?.next?.[0]).toMatchObject({
      tool: "getContent",
      args: { id: "5278156" },
      example: "confluence getContent --id 5278156",
    });
  });

  it("does not inject meta.next when --recommend=false", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli(["--recommend=false", "urlParse", "--url", "https://cf.cloudglab.cn/pages/viewpage.action?pageId=5278156"]);

    const output = String(write.mock.calls.at(-1)?.[0] ?? "").trim();
    const parsed = JSON.parse(output) as { meta?: { next?: Array<Record<string, unknown>> } };
    expect(parsed.meta?.next).toBeUndefined();
  });
});
