import type { Node, Parent } from "mdast";
import type { ConversionContext } from "./types.js";

export type Converter<T extends Node = Node> = (
  node: T,
  context: ConversionContext,
  convertChildren: (node: Parent) => string,
) => string;

export const converters: Map<string, Converter> = new Map();

export function registerConverter<T extends Node>(type: string, converter: Converter<T>): void {
  converters.set(type, converter as Converter);
}
