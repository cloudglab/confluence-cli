import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function mockSpawn(stdout = "") {
  vi.doMock("node:child_process", () => ({
    spawn: vi.fn(() => {
      const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => {
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
    writeFile: vi.fn(async () => undefined),
  }));
}

describe("runDailyUpdateProbe", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("发现新版本时只提示更新命令", async () => {
    process.env.NODE_ENV = "development";
    mockSpawn("0.1.20\n");
    mockUpdateFiles();
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { runDailyUpdateProbe } = await import("../src/update-probe.js");

    await runDailyUpdateProbe("searchContent");

    expect(write).toHaveBeenCalledWith(expect.stringContaining("检测到 Confluence CLI 新版本 0.1.20（当前 0.1.0）。"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("confluence update --skip-config-check true"));
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
});
