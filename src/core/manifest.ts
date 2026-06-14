import { readFile } from "node:fs/promises";
import { InMemoryCliRegistry } from "./cli-registry.js";
import { registerTools } from "./tool-registry.js";
import { hasToolGroup, type ToolGroup } from "./roles.js";
import type { Role } from "../types/common.js";

export interface Manifest {
  version: string;
  commands: string[];
  groups: Record<string, string[]>;
  commandToGroup: Record<string, string>;
}

let manifestCache: Manifest | undefined | null = null;

export async function loadManifest(): Promise<Manifest | undefined> {
  if (manifestCache !== null) return manifestCache ?? undefined;

  try {
    const manifestPath = new URL("../../dist/manifest.json", import.meta.url);
    const content = await readFile(manifestPath, "utf8");
    manifestCache = JSON.parse(content) as Manifest;
    return manifestCache;
  } catch {
    manifestCache = undefined;
    return undefined;
  }
}

export async function getAvailableCommandNames(role: Role): Promise<string[]> {
  const manifest = await loadManifest();
  if (manifest) {
    const names = new Set<string>();
    for (const [group, commands] of Object.entries(manifest.groups)) {
      if (hasToolGroup(role, group as ToolGroup)) {
        for (const command of commands) {
          names.add(command);
        }
      }
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }

  const registry = new InMemoryCliRegistry();
  await registerTools(registry, role);
  return registry.list().map((command) => command.name);
}

export async function buildRegistryForCommand(role: Role, commandName: string): Promise<InMemoryCliRegistry> {
  const registry = new InMemoryCliRegistry();
  await registerTools(registry, role, { commandName });
  return registry;
}
