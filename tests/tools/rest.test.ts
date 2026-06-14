import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";

function mockRestDependencies(requestResult: unknown = { ok: true }) {
  const request = vi.fn(async () => requestResult);
  vi.doMock("../../src/core/config.js", () => ({ loadConfluenceConfig: vi.fn(() => ({ url: "https://confluence.example.com", apiBaseUrl: "https://confluence.example.com/rest/api", authType: "pat", personalToken: "token", source: "test" })) }));
  vi.doMock("../../src/api/index.js", () => ({
    ConfluenceApi: class {
      request = request;
    },
  }));
  return { request };
}

describe("REST tools", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.CONFLUENCE_DISABLE_WRITE;
  });

  it("lists REST endpoints with filters and limit", async () => {
    const { registerRestTools } = await import("../../src/tools/rest.js");
    const registry = new InMemoryCliRegistry();
    registerRestTools(registry);

    const result = await registry.get("listRestApis")!.handler({ method: "GET", group: "content", limit: 2 });
    const output = JSON.parse(result.content[0]!.text) as { total: number; endpoints: unknown[] };

    expect(output.total).toBeGreaterThanOrEqual(2);
    expect(output.endpoints).toHaveLength(2);
  });

  it("applies path params and calls supported read endpoint", async () => {
    const { request } = mockRestDependencies({ id: "123" });
    const { registerRestTools } = await import("../../src/tools/rest.js");
    const registry = new InMemoryCliRegistry();
    registerRestTools(registry);

    const result = await registry.get("callRestApi")!.handler({ method: "GET", path: "/content/{id}", pathParams: { id: "a b" }, query: { expand: "version" }, confirm: false });

    expect(request).toHaveBeenCalledWith("GET", "/content/a%20b", { expand: "version" }, undefined);
    expect(JSON.parse(result.content[0]!.text)).toEqual({ id: "123" });
  });

  it("previews supported write endpoint until confirm is true", async () => {
    const { request } = mockRestDependencies({ id: "created" });
    const { registerRestTools } = await import("../../src/tools/rest.js");
    const registry = new InMemoryCliRegistry();
    registerRestTools(registry);

    const preview = await registry.get("callRestApi")!.handler({ method: "POST", path: "/content", pathParams: {}, query: {}, body: { title: "T" }, confirm: false });
    const output = JSON.parse(preview.content[0]!.text) as { preview: boolean };

    expect(output.preview).toBe(true);
    expect(request).not.toHaveBeenCalled();

    await registry.get("callRestApi")!.handler({ method: "POST", path: "/content", pathParams: {}, query: {}, body: { title: "T" }, confirm: true });
    expect(request).toHaveBeenCalledWith("POST", "/content", {}, { title: "T" });
  });
});
