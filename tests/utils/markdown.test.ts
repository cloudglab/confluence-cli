import { describe, expect, it } from "vitest";
import { markdownToStorage, normalizeMarkdownForConfluence } from "../../src/utils/markdown.js";

describe("markdown utilities", () => {
  it("removes duplicated markdown table headers before storage conversion", () => {
    const input = [
      "| 字段 | 含义 |",
      "| 字段 | 含义 |",
      "| --- | --- |",
      "| host | 域名 |",
    ].join("\n");

    const normalized = normalizeMarkdownForConfluence(input);

    expect(normalized).toBe(["| 字段 | 含义 |", "| --- | --- |", "| host | 域名 |"].join("\n"));
  });

  it("escapes curly braces outside code fences", () => {
    const input = [
      "变量 {domain} 需要转义",
      "",
      "```bash",
      "echo {domain}",
      "```",
    ].join("\n");

    const normalized = normalizeMarkdownForConfluence(input);

    expect(normalized).toContain("变量 \\{domain\\} 需要转义");
    expect(normalized).toContain("echo {domain}");
  });

  it("converts code blocks and local images to confluence storage macros", () => {
    const input = [
      '![diagram](demo.png)',
      "",
      "```ts",
      "const domain = '{domain}';",
      "```",
    ].join("\n");

    const storage = markdownToStorage(input);

    expect(storage).toContain('<ri:attachment ri:filename="demo.png" />');
    expect(storage).toContain('<ac:structured-macro ac:name="code"');
    expect(storage).toContain('<ac:parameter ac:name="language">js</ac:parameter>');
  });

  it("renders markdown tables as confluence storage table html", () => {
    const input = [
      "| 字段 | 含义 |",
      "| --- | --- |",
      "| host | 域名 |",
      "| token | 凭证 |",
    ].join("\n");

    const storage = markdownToStorage(input);

    expect(storage).toContain("<table>");
    expect(storage).toContain("<thead><tr><th>字段</th><th>含义</th></tr></thead>");
    expect(storage).toContain("<tbody><tr><td>host</td><td>域名</td></tr><tr><td>token</td><td>凭证</td></tr></tbody>");
  });

  it("normalizes html br tags inside markdown table cells for confluence storage", () => {
    const input = [
      "| 影响 | 说明 |",
      "| --- | --- |",
      "| 对外接口 | 第一行<br>第二行<BR/>第三行<br />第四行 |",
    ].join("\n");

    const storage = markdownToStorage(input);

    expect(storage).toContain("第一行<br />第二行<br />第三行<br />第四行");
    expect(storage).not.toContain("<br>");
    expect(storage).not.toContain("<BR/>");
  });
});
