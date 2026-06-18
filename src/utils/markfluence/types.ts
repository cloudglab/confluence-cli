import type { Node } from "mdast";

export interface Frontmatter {
  "confluence-page-id"?: string;
  "confluence-space"?: string;
  title?: string;
  labels?: string[];
}

export interface ParsedDocument {
  frontmatter: Frontmatter;
  ast: Node;
  title: string;
}

export interface ConversionConfig {
  mermaid?: boolean;
  verbose?: boolean;
}

export interface AttachmentInfo {
  filename: string;
  data: Buffer;
  contentType: string;
}

export interface ConversionContext {
  config: ConversionConfig;
  frontmatter: Frontmatter;
  attachments: Map<string, AttachmentInfo>;
  pageId?: string;
}
