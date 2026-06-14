import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

function mockHomeDir(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), "confluence-config-"));
  tempDirs.push(tempDir);
  vi.doMock("node:os", () => ({ homedir: () => tempDir }));
  return tempDir;
}

describe("config helpers", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("normalizes PAT config and masks secrets", async () => {
    const { normalizeConfig, maskConfig } = await import("../../src/core/config.js");

    const config = normalizeConfig({ url: "https://confluence.example.com/", personalToken: "abcdef123456" });

    expect(config.url).toBe("https://confluence.example.com");
    expect(config.apiBaseUrl).toBe("https://confluence.example.com/rest/api");
    expect(config.authType).toBe("pat");
    expect(maskConfig(config).personalToken).toBe("abc***456");
  });

  it("normalizes Basic config and rejects missing credentials", async () => {
    const { normalizeConfig } = await import("../../src/core/config.js");

    const config = normalizeConfig({ url: "confluence.example.com/", username: "alice", password: "password123" });

    expect(config.url).toBe("https://confluence.example.com");
    expect(config.authType).toBe("basic");
    expect(config.password).toBe("password123");
    expect(() => normalizeConfig({ url: "https://confluence.example.com" })).toThrow("缺少凭证");
  });

  it("loads config from environment before config file", async () => {
    process.env = {
      ...originalEnv,
      CONFLUENCE_URL: "https://env-confluence.example.com",
      CONFLUENCE_PAT: "env-token",
    };
    const { loadConfluenceConfig } = await import("../../src/core/config.js");

    expect(loadConfluenceConfig()).toMatchObject({
      url: "https://env-confluence.example.com",
      authType: "pat",
      personalToken: "env-token",
    });
  });

  it("merges non-empty environment overrides with config file", async () => {
    const homeDir = mockHomeDir();
    const configDir = path.join(homeDir, ".confluence");
    mkdirSync(configDir);
    writeFileSync(path.join(configDir, "config.json"), `${JSON.stringify({
      url: "https://file-confluence.example.com",
      personalToken: "file-token",
    })}\n`);
    process.env = {
      ...originalEnv,
      CONFLUENCE_API_BASE_URL: "https://api-confluence.example.com/rest/api/",
      CONFLUENCE_PAT: "  ",
    };

    const { loadConfluenceConfig } = await import("../../src/core/config.js");

    expect(loadConfluenceConfig()).toMatchObject({
      url: "https://file-confluence.example.com",
      apiBaseUrl: "https://api-confluence.example.com/rest/api",
      authType: "pat",
      personalToken: "file-token",
    });
  });

  it("reports broken config file with path context", async () => {
    const homeDir = mockHomeDir();
    const configDir = path.join(homeDir, ".confluence");
    mkdirSync(configDir);
    writeFileSync(path.join(configDir, "config.json"), "[]\n");

    const { loadConfluenceConfig } = await import("../../src/core/config.js");

    expect(() => loadConfluenceConfig()).toThrow("Confluence 配置文件损坏");
    expect(() => loadConfluenceConfig()).toThrow(path.join(configDir, "config.json"));
  });
});
