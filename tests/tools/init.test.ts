import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCliRegistry } from "../../src/core/cli-registry.js";

function mockApi(currentUser = { username: "me" }) {
  vi.doMock("../../src/api/index.js", () => ({
    ConfluenceApi: class {
      getCurrentUser = vi.fn(async () => currentUser);
    },
  }));
}

describe("initConfluence tool", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("normalizes, saves, validates, and masks config", async () => {
    const saveConfig = vi.fn();
    const normalized = {
      url: "https://confluence.example.com",
      apiBaseUrl: "https://confluence.example.com/rest/api",
      authType: "pat",
      personalToken: "secret-token",
      source: "~/.confluence/config.json",
    };
    vi.doMock("../../src/core/config.js", () => ({
      loadConfluenceConfig: vi.fn(),
      normalizeConfig: vi.fn(() => normalized),
      saveConfig,
      maskConfig: vi.fn((config: typeof normalized) => ({ ...config, personalToken: "sec***ken" })),
    }));
    mockApi();

    const { registerInitTools } = await import("../../src/tools/init.js");
    const registry = new InMemoryCliRegistry();
    registerInitTools(registry);

    const result = await registry.get("initConfluence")!.handler({ url: "https://confluence.example.com", pat: "secret-token", save: true });
    const output = JSON.parse(result.content[0]!.text) as { ok: boolean; saved: boolean; config: { personalToken: string } };

    expect(saveConfig).toHaveBeenCalledWith(normalized);
    expect(output).toEqual({ ok: true, saved: true, config: { ...normalized, personalToken: "sec***ken" } });
  });

  it("falls back to existing config when no credentials are passed", async () => {
    const stored = {
      url: "https://stored-confluence.example.com",
      apiBaseUrl: "https://stored-confluence.example.com/rest/api",
      authType: "pat",
      personalToken: "stored-token",
      source: "~/.confluence/config.json",
    };
    const loadConfluenceConfig = vi.fn(() => stored);
    vi.doMock("../../src/core/config.js", () => ({
      loadConfluenceConfig,
      normalizeConfig: vi.fn(),
      saveConfig: vi.fn(),
      maskConfig: vi.fn((config: typeof stored) => ({ ...config, personalToken: "sto***ken" })),
    }));
    mockApi();

    const { registerInitTools } = await import("../../src/tools/init.js");
    const registry = new InMemoryCliRegistry();
    registerInitTools(registry);

    await registry.get("initConfluence")!.handler({ save: false });

    expect(loadConfluenceConfig).toHaveBeenCalled();
  });
});
