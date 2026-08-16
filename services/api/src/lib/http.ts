import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  const code = known ? error.code : "internal_error";
  if (!known) console.error(error);
  response.status(status).json({ error: { code, message: known ? error.message : "An unexpected server error occurred." } });
}
