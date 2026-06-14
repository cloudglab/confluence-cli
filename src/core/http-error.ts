import type { HttpError } from "./http.js";

export function isHttpStatusError(error: unknown, statusCode: number): error is HttpError {
  return error instanceof Error && "statusCode" in error && (error as HttpError).statusCode === statusCode;
}
