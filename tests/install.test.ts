import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { homedir } from "node:os";

const commandCalls: Array<{ command: string; args: string[] }> = [];

function mockSpawn(stdoutByCommand = new Map<string, string>()) {
  vi.doMock("node:child_process", () => ({
    spawn: vi.fn((command: string, args: string[]) => {
      commandCalls.push({ command, args });
      const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      (child.stdout as EventEmitter & { pipe: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      queueMicrotask(() => {
        const key = `${command} ${args.join(" ")}`;
        const stdout = stdoutByCommand.get(key);
        if (stdout) child.stdout.emit("data", Buffer.from(stdout));
        child.emit("close", 0);
      });

      return child;
    }),
  }));
}

function mockInstallDependencies() {
  vi.doMock("node:fs/promises", () => ({
    access: vi.fn(async () => undefined),
    mkdtemp: vi.fn(async () => "/tmp/confluence-cli-skill-abc"),
    rm: vi.fn(async () => undefined),
  }));
  vi.doMock("node:os", () => ({ default: { tmpdir: () => "/tmp", homedir: () => homedir() } }));
  vi.doMock("../src/api/index.js", () => ({
    ConfluenceApi: class {
      getCurrentUser = vi.fn(async () => ({ username: "me" }));
    },
  }));
  vi.doMock("../src/core/config.js", () => ({
    loadConfluenceConfig: vi.fn(() => ({ url: "https://confluence.example.com", apiBaseUrl: "https://confluence.example.com/rest/api", authType: "pat", personalToken: "secret", source: "~/.confluence/config.json" })),
    normalizeConfig: vi.fn((config: unknown) => config),
    saveConfig: vi.fn(),
  }));
  vi.doMock("../src/update-probe.js", () => ({
    writeUpdateCacheAfterInstall: vi.fn(async () => undefined),
  }));
}

function createSpawnPlan(entries: Array<{ command: string; args: string[]; code?: number; stdout?: string; stderr?: string }>) {
  return new Map(entries.map((entry) => [`${entry.command} ${entry.args.join(" ")}`, entry]));
}

type SpawnPlanEntry = { command: string; args: string[]; code?: number; stdout?: string; stderr?: string };

describe("install command", () => {
  afterEach(() => {
    commandCalls.length = 0;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("默认安装 CLI 并把 skill 装到全局目录", async () => {
    mockSpawn(new Map([["npm root -g", "/usr/local/lib/node_modules\n"]]));
    mockInstallDependencies();
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { runInstallCommand } = await import("../src/install.js");

    await runInstallCommand(["--skip-config-check"]);

    expect(commandCalls).toEqual([
      { command: "npm", args: ["root", "-g"] },
      { command: "npm", args: ["install", "-g", "@cloudglab/confluence-cli@latest"] },
      { command: "npm", args: ["install", "-g", "beautiful-mermaid-cli@latest"] },
      { command: "npm", args: ["root", "-g"] },
      { command: "npx", args: ["-y", "skills", "add", path.join("/usr/local/lib/node_modules", "@cloudglab/confluence-cli", "skills", "confluence-cli"), "--global", "--yes"] },
    ]);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("安装完成，已跳过 Confluence 配置校验。"));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("   ___       ___"));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("快速开始："));
  });

  it("本地 skill 缺失时自动回退到 npm 包解压安装，Mermaid 渲染器失败不阻断安装", async () => {
    const plan = createSpawnPlan([
      { command: "npm", args: ["root", "-g"], stdout: "/usr/local/lib/node_modules\n" },
      { command: "npm", args: ["install", "-g", "@cloudglab/confluence-cli@latest"] },
      { command: "npm", args: ["install", "-g", "beautiful-mermaid-cli@latest"], code: 1, stderr: "npm ERR! network timeout\n" },
      { command: "npm", args: ["pack", "@cloudglab/confluence-cli@latest", "--pack-destination", "/tmp/confluence-cli-skill-abc", "--silent"], stdout: "cloudglab-confluence-cli-0.1.0.tgz\n" },
      { command: "tar", args: ["-xzf", "/tmp/confluence-cli-skill-abc/cloudglab-confluence-cli-0.1.0.tgz", "-C", "/tmp/confluence-cli-skill-abc"] },
      { command: "npx", args: ["-y", "skills", "add", "/tmp/confluence-cli-skill-abc/package", "--global", "--yes"] },
    ]);

    vi.doMock("node:child_process", () => ({
      spawn: vi.fn((command: string, args: string[]) => {
        commandCalls.push({ command, args });
        const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        (child.stdout as EventEmitter & { pipe: ReturnType<typeof vi.fn> }).pipe = vi.fn();

        queueMicrotask(() => {
          const key = `${command} ${args.join(" ")}`;
          const hit: Partial<SpawnPlanEntry> = plan.get(key) ?? { code: 0 };
          if (hit.stdout) child.stdout.emit("data", Buffer.from(hit.stdout));
          if (hit.stderr) child.stderr.emit("data", Buffer.from(hit.stderr));
          child.emit("close", hit.code ?? 0);
        });

        return child;
      }),
    }));
    vi.doMock("node:fs/promises", () => ({
      access: vi.fn(async (filePath: string) => {
        if (filePath.includes("skills/confluence-cli")) {
          throw new Error("missing skill");
        }
      }),
      mkdtemp: vi.fn(async () => "/tmp/confluence-cli-skill-abc"),
      rm: vi.fn(async () => undefined),
      readdir: vi.fn(async () => []),
    }));
    vi.doMock("node:os", () => ({ default: { tmpdir: () => "/tmp", homedir: () => homedir() } }));
    vi.doMock("../src/api/index.js", () => ({
      ConfluenceApi: class {
        getCurrentUser = vi.fn(async () => ({ username: "me" }));
      },
    }));
    vi.doMock("../src/core/config.js", () => ({
      loadConfluenceConfig: vi.fn(() => ({ url: "https://confluence.example.com", apiBaseUrl: "https://confluence.example.com/rest/api", authType: "pat", personalToken: "secret", source: "~/.confluence/config.json" })),
      normalizeConfig: vi.fn((config: unknown) => config),
      saveConfig: vi.fn(),
    }));
    vi.doMock("../src/update-probe.js", () => ({
      writeUpdateCacheAfterInstall: vi.fn(async () => undefined),
    }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { runInstallCommand } = await import("../src/install.js");

    await runInstallCommand(["--skip-config-check"]);

    expect(commandCalls).toEqual([
      { command: "npm", args: ["root", "-g"] },
      { command: "npm", args: ["install", "-g", "@cloudglab/confluence-cli@latest"] },
      { command: "npm", args: ["install", "-g", "beautiful-mermaid-cli@latest"] },
      { command: "npm", args: ["root", "-g"] },
      { command: "npm", args: ["pack", "@cloudglab/confluence-cli@latest", "--pack-destination", "/tmp/confluence-cli-skill-abc", "--silent"] },
      { command: "tar", args: ["-xzf", "/tmp/confluence-cli-skill-abc/cloudglab-confluence-cli-0.1.0.tgz", "-C", "/tmp/confluence-cli-skill-abc"] },
      { command: "npx", args: ["-y", "skills", "add", "/tmp/confluence-cli-skill-abc/package", "--global", "--yes"] },
    ]);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("已跳过 beautiful-mermaid-cli 安装："));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("正在自动回退到 npm 包解压安装"));
    expect(stderr).toHaveBeenCalled();
  });

  it("支持 npm skill 来源、本地 skill 路径和布尔参数", async () => {
    mockSpawn(new Map([["npm pack @cloudglab/confluence-cli@latest --pack-destination /tmp/confluence-cli-skill-abc --silent", "cloudglab-confluence-cli-0.1.0.tgz\n"]]));
    mockInstallDependencies();
    const { runInstallCommand, runUpdateCommand } = await import("../src/install.js");

    await runInstallCommand(["--skill-source=npm", "--skip-config-check=true"]);
    await runUpdateCommand(["--skill-local-path", "./local-skill", "--skill-only", "true", "--skip-config-check", "true"]);

    expect(commandCalls).toEqual([
      { command: "npm", args: ["root", "-g"] },
      { command: "npm", args: ["install", "-g", "@cloudglab/confluence-cli@latest"] },
      { command: "npm", args: ["install", "-g", "beautiful-mermaid-cli@latest"] },
      { command: "npm", args: ["pack", "@cloudglab/confluence-cli@latest", "--pack-destination", "/tmp/confluence-cli-skill-abc", "--silent"] },
      { command: "tar", args: ["-xzf", "/tmp/confluence-cli-skill-abc/cloudglab-confluence-cli-0.1.0.tgz", "-C", "/tmp/confluence-cli-skill-abc"] },
      { command: "npx", args: ["-y", "skills", "add", "/tmp/confluence-cli-skill-abc/package", "--global", "--yes"] },
      { command: "npx", args: ["-y", "skills", "add", path.resolve("./local-skill"), "--global", "--yes"] },
    ]);
  });

  it("--skill-global false 时改为项目级安装", async () => {
    mockSpawn(new Map([["npm root -g", "/usr/local/lib/node_modules\n"]]));
    mockInstallDependencies();
    const { runInstallCommand } = await import("../src/install.js");

    await runInstallCommand(["--skill-global", "false", "--skip-config-check"]);

    expect(commandCalls).toEqual([
      { command: "npm", args: ["root", "-g"] },
      { command: "npm", args: ["install", "-g", "@cloudglab/confluence-cli@latest"] },
      { command: "npm", args: ["install", "-g", "beautiful-mermaid-cli@latest"] },
      { command: "npm", args: ["root", "-g"] },
      { command: "npx", args: ["-y", "skills", "add", path.join("/usr/local/lib/node_modules", "@cloudglab/confluence-cli", "skills", "confluence-cli"), "--yes"] },
    ]);
  });

  it("未确认时展示卸载预览", async () => {
    mockSpawn();
    mockInstallDependencies();
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { runUninstallCommand } = await import("../src/install.js");

    await runUninstallCommand([]);

    expect(commandCalls).toEqual([]);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("卸载预览："));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("confluence uninstall --confirm true"));
  });
});
