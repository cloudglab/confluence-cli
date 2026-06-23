import { afterEach, describe, expect, it, vi } from "vitest";
import { looksLikeUrl, parseConfluenceUrl } from "../../src/core/url-parser.js";

const EXPECTED = "cf.cloudglab.cn";

describe("parseConfluenceUrl - page routes", () => {
  it("viewpage.action?pageId=N → page", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=5278156`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.pageId).toBe("5278156");
    expect(r.matchedServer).toBe(true);
    expect(r.primaryCommand).toBe("getContent");
    expect(r.suggestedCommands).toContain("getPageSnapshot");
  });

  it("viewpage.action#comment-N → comment (hash)", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=123#comment-456`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("comment");
    expect(r.params.pageId).toBe("123");
    expect(r.params.commentId).toBe("456");
    expect(r.primaryCommand).toBe("getComments");
  });

  it("viewpage.action?focusedCommentId=N → comment (Cloud)", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=123&focusedCommentId=789`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("comment");
    expect(r.params.commentId).toBe("789");
  });

  it("editpage.action?pageId=N → edit", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/editpage.action?pageId=123`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("edit");
    expect(r.params.pageId).toBe("123");
    expect(r.primaryCommand).toBe("getContent");
    expect(r.suggestedCommands).toContain("uploadMarkdown");
  });

  it("viewpreviousversions.action?pageId=N → history", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpreviousversions.action?pageId=123`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("history");
    expect(r.params.pageId).toBe("123");
    expect(r.note).toContain("历史");
  });

  it("Cloud /spaces/{K}/pages/{id}/{title} → page (Cloud 7.x)", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/spaces/GABI/pages/5278156/GA-BI`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.spaceKey).toBe("GABI");
    expect(r.params.pageId).toBe("5278156");
    expect(r.params.slug).toBe("GA-BI");
    expect(r.note).toContain("Cloud");
  });

  it("/spaces/{K}/folder/{id} → page with isFolder", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/spaces/GABI/folder/12345`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.spaceKey).toBe("GABI");
    expect(r.params.folderId).toBe("12345");
    expect(r.params.isFolder).toBe(1);
    expect(r.note).toContain("folder");
  });

  it("/spaces/{K}/{slug}-{id} → page (slug-id 旧版链接)", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/spaces/DEV/some-page-name-9999`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.spaceKey).toBe("DEV");
    expect(r.params.pageId).toBe("9999");
    expect(r.params.slug).toBe("some-page-name");
  });
});

describe("parseConfluenceUrl - space routes", () => {
  it("/spaces/{K}/overview → space", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/spaces/GABI/overview`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("space");
    expect(r.params.spaceKey).toBe("GABI");
    expect(r.primaryCommand).toBe("getSpace");
  });

  it("/spaces/{K} → space (无 overview 后缀)", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/spaces/GABI`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("space");
    expect(r.params.spaceKey).toBe("GABI");
  });

  it("/display/{K} → space (无 slug)", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/display/GABI`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("space");
    expect(r.params.spaceKey).toBe("GABI");
  });

  it("/display/{K}/{slug} → page", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/display/GABI/some-slug`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.spaceKey).toBe("GABI");
    expect(r.params.slug).toBe("some-slug");
  });
});

describe("parseConfluenceUrl - other routes", () => {
  it("/search?queryString=... → search", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/search?queryString=API%20docs`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("search");
    expect(r.params.queryString).toBe("API docs");
    expect(r.primaryCommand).toBe("searchContent");
  });

  it("/download/attachments/{pageId}/{filename} → attachment", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/download/attachments/12345/report.pdf`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("attachment");
    expect(r.params.pageId).toBe("12345");
    expect(r.params.filename).toBe("report.pdf");
    expect(r.primaryCommand).toBe("downloadAttachment");
  });

  it("/download/attachments/.../file.png?version=2 → attachment 带 version", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/download/attachments/12345/file.png?version=2`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("attachment");
    expect(r.params.version).toBe("2");
  });

  it("/download/attachments/.../中文文件名 → filename 解码", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/download/attachments/12345/${encodeURIComponent("中文.png")}`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("attachment");
    expect(r.params.filename).toBe("中文.png");
  });

  it("/rest/api/content → api", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/rest/api/content?limit=5`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("api");
    expect(r.primaryCommand).toBe("callRestApi");
  });

  it("/dashboard → dashboard", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/dashboard`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("dashboard");
  });

  it("/dashboard.action → dashboard", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/dashboard.action`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("dashboard");
  });

  it("/x/{shortcode} → unknown + Tiny link note", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/x/abc123`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("unknown");
    expect(r.params.shortCode).toBe("abc123");
    expect(r.note).toContain("Tiny link");
  });
});

describe("parseConfluenceUrl - matchedServer", () => {
  it("expectedHost 一致 → matchedServer=true", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=1`, { expectedHost: EXPECTED });
    expect(r.matchedServer).toBe(true);
  });

  it("expectedHost 不一致 → matchedServer=false + note", () => {
    const r = parseConfluenceUrl(`https://other.example.com/pages/viewpage.action?pageId=1`, { expectedHost: EXPECTED });
    expect(r.matchedServer).toBe(false);
    expect(r.note).toContain("主机不匹配");
  });

  it("显式传 expectedHost 且端口不同 → matchedServer=false", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}:8080/pages/viewpage.action?pageId=1`, { expectedHost: EXPECTED });
    expect(r.matchedServer).toBe(false);
  });

  it("requireMatchedServer 在不一致时抛错", () => {
    expect(() =>
      parseConfluenceUrl(`https://other.example.com/pages/viewpage.action?pageId=1`, {
        expectedHost: EXPECTED,
        requireMatchedServer: true,
      }),
    ).toThrow(/主机 .* 与期望/);
  });

  it("requireMatchedServer 在一致时通过", () => {
    expect(() =>
      parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=1`, {
        expectedHost: EXPECTED,
        requireMatchedServer: true,
      }),
    ).not.toThrow();
  });
});

describe("parseConfluenceUrl - 边界", () => {
  it("空字符串抛错", () => {
    expect(() => parseConfluenceUrl("")).toThrow("URL 不能为空");
  });

  it("纯空白抛错", () => {
    expect(() => parseConfluenceUrl("   ")).toThrow("URL 不能为空");
  });

  it("无效 URL 抛错", () => {
    expect(() => parseConfluenceUrl("not a url with spaces only")).toThrow(/无法解析/);
  });

  it("raw host(无 scheme)自动补 https://", () => {
    const r = parseConfluenceUrl(`${EXPECTED}/pages/viewpage.action?pageId=1`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.parsed.host).toBe(EXPECTED);
  });

  it("未知 URL 保留 rawPath 供调试", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/some/random/path`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("unknown");
    expect(r.params.path).toBe("/some/random/path");
    expect(r.suggestedCommands).toContain("searchContent");
  });

  it("剥 /wiki base path", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/wiki/spaces/GABI/pages/1/Foo`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.pageId).toBe("1");
  });

  it("剥 /confluence base path", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/confluence/spaces/GABI/pages/1/Foo`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("page");
    expect(r.params.pageId).toBe("1");
  });

  it("viewpage.action 无 pageId → unknown + 保留 rawPath", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("unknown");
    expect(r.params.path).toBe("/pages/viewpage.action");
  });

  it("viewpage.action 非数字 pageId → unknown", () => {
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=abc`, { expectedHost: EXPECTED });
    expect(r.routeKind).toBe("unknown");
  });
});

describe("looksLikeUrl", () => {
  it("检测 https:// URL", () => {
    expect(looksLikeUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=1`)).toBe(true);
  });

  it("检测 http:// URL", () => {
    expect(looksLikeUrl(`http://${EXPECTED}/`)).toBe(true);
  });

  it("检测 atlassian.net 子域", () => {
    expect(looksLikeUrl("mycompany.atlassian.net/wiki/spaces/DEV")).toBe(true);
  });

  it("检测 cloudglab.cn 子域", () => {
    expect(looksLikeUrl(`cf.cloudglab.cn/pages/viewpage.action`)).toBe(true);
  });

  it("检测 confluence. 子域", () => {
    expect(looksLikeUrl("wiki.confluence.example.com/display/DEV")).toBe(true);
  });

  it("拒绝普通命令名", () => {
    expect(looksLikeUrl("searchContent")).toBe(false);
    expect(looksLikeUrl("listSpaces")).toBe(false);
    expect(looksLikeUrl("getContent 12345")).toBe(false);
  });

  it("拒绝空字符串", () => {
    expect(looksLikeUrl("")).toBe(false);
  });

  it("先 trim 再检测", () => {
    expect(looksLikeUrl(`  https://${EXPECTED}/  `)).toBe(true);
  });

  it("拒绝裸 atlassian.net(无子域)", () => {
    expect(looksLikeUrl("atlassian.net")).toBe(false);
  });
});

describe("defaultExpectedHost via env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CONFLUENCE_URL env 优先", () => {
    vi.stubEnv("CONFLUENCE_URL", `https://${EXPECTED}`);
    const r = parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=1`);
    expect(r.matchedServer).toBe(true);
  });

  it("env 非法 URL 时静默 fallthrough(不抛)", () => {
    vi.stubEnv("CONFLUENCE_URL", "not a url");
    expect(() =>
      parseConfluenceUrl(`https://${EXPECTED}/pages/viewpage.action?pageId=1`),
    ).not.toThrow();
  });
});