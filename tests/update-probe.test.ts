import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const writeFileMock = vi.fn(async () => undefined);

function mockSpawn(stdout = "") {
  vi.doMock("node:child_process", () => ({
    spawn: vi.fn((command: string) => {
      const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      (child as EventEmitter & { unref?: () => void }).unref = vi.fn();
      queueMicrotask(() => {
        if (command === process.execPath) {
          child.emit("close", 0);
          return;
        }
        if (stdout) child.stdout.emit("data", Buffer.from(stdout));
        child.emit("close", 0);
      });
      return child;
    }),
  }));
}

function mockUpdateFiles() {
  vi.doMock("node:os", () => ({ homedir: () => "/tmp/home" }));
  vi.doMock("node:fs/promises", () => ({
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async () => { throw new Error("missing"); }),
    writeFile: writeFileMock,
  }));
}

describe("runDailyUpdateProbe", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("有缓存新版本时提示 update 命令", async () => {
    process.env.NODE_ENV = "development";
    mockSpawn();
    vi.doMock("node:os", () => ({ homedir: () => "/tmp/home" }));
    vi.doMock("node:fs/promises", () => ({
      mkdir: vi.fn(async () => undefined),
      readFile: vi.fn(async () => JSON.stringify({ lastCheckedDate: "2026-06-14", latestVersion: "0.1.20", currentVersion: "0.1.2" })),
      writeFile: writeFileMock,
    }));
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { runDailyUpdateProbe } = await import("../src/update-probe.js");

    await runDailyUpdateProbe("searchContent");

    expect(write).toHaveBeenCalledWith(expect.stringContaining("检测到 Confluence CLI 新版本 0.1.20（当前 0.1.2）。"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence update --skip-config-check"));
  });

  it("跳过测试环境和保留命令", async () => {
    process.env.NODE_ENV = "test";
    mockSpawn("0.1.20\n");
    mockUpdateFiles();
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { runDailyUpdateProbe } = await import("../src/update-probe.js");

    await runDailyUpdateProbe("help");

    expect(write).not.toHaveBeenCalled();
  });

  it("安装后写入更新缓存", async () => {
    mockSpawn();
    mockUpdateFiles();
    const { writeUpdateCacheAfterInstall } = await import("../src/update-probe.js");

    await writeUpdateCacheAfterInstall("0.1.0");

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining(".confluence/update-check.json"),
      expect.stringContaining('"latestVersion": "0.1.0"'),
      expect.objectContaining({ mode: 0o600 }),
    );
  });
});
