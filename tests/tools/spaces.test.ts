import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";

describe("space tools", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("registers whoami aliases for current user", async () => {
    const currentUser = { username: "me", displayName: "Demo User" };
    vi.doMock("../../src/api/index.js", () => ({
      ConfluenceApi: class {
        getCurrentUser = vi.fn(async () => currentUser);
      },
    }));
    vi.doMock("../../src/core/config.js", () => ({
      loadConfluenceConfig: vi.fn(() => ({ apiBaseUrl: "https://confluence.example.com/rest/api", authType: "pat", personalToken: "token" })),
    }));

    const { registerSpaceTools } = await import("../../src/tools/spaces.js");
    const registry = new InMemoryCliRegistry();
    registerSpaceTools(registry);

    expect(registry.get("getCurrentUser")).toBeDefined();
    expect(registry.get("whoami")).toBeDefined();
    expect(registry.get("who-am-i")).toBeDefined();

    const result = await registry.get("whoami")!.handler({});
    expect(JSON.parse(result.content[0]!.text)).toEqual(currentUser);
  });

  it("registers configShow and returns masked config metadata", async () => {
    vi.doMock("../../src/core/config.js", () => ({
      loadConfluenceConfig: vi.fn(() => ({
        url: "https://confluence.example.com",
        apiBaseUrl: "https://confluence.example.com/rest/api",
        authType: "pat",
        personalToken: "token123456",
        source: "~/.confluence/config.json",
      })),
      maskConfig: vi.fn((config) => ({ ...config, personalToken: "tok***456" })),
      getConfigFilePath: vi.fn(() => "/tmp/.confluence/config.json"),
    }));

    const { registerSpaceTools } = await import("../../src/tools/spaces.js");
    const registry = new InMemoryCliRegistry();
    registerSpaceTools(registry);

    const result = await registry.get("configShow")!.handler({});
    expect(JSON.parse(result.content[0]!.text)).toEqual({
      url: "https://confluence.example.com",
      apiBaseUrl: "https://confluence.example.com/rest/api",
      authType: "pat",
      personalToken: "tok***456",
      source: "~/.confluence/config.json",
      configPath: "/tmp/.confluence/config.json",
    });
  });
});
