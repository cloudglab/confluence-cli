export type Role = "full" | "reader" | "writer";

export interface JsonContentResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface ConfluenceConfig {
  url: string;
  apiBaseUrl: string;
  authType: "pat" | "basic";
  username?: string;
  password?: string;
  personalToken?: string;
  source: string;
}

export type ToolHandler<TInput> = (input: TInput) => Promise<JsonContentResult> | JsonContentResult;
