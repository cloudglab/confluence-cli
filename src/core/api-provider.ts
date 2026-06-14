import { ConfluenceApi } from "../api/index.js";
import { loadConfluenceConfig } from "./config.js";

let api: ConfluenceApi | null = null;

export function setApi(nextApi: ConfluenceApi): void {
  api = nextApi;
}

export function getApi(): ConfluenceApi {
  if (api) return api;
  api = new ConfluenceApi(loadConfluenceConfig());
  return api;
}
