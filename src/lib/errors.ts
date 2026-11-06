import type { FieldErrors } from "./validation";

export type ErrorCode = "validation" | "not_found" | "conflict" | "unavailable";

/** Expected, user-presentable failure. Never carries SQL text or credentials. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: FieldErrors };
