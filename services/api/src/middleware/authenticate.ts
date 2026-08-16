import type { NextFunction, Request, Response } from "express";
import type { ApiConfig } from "../config.js";
import { verifyAccessToken, type AccessClaims } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

export function requireAuth(config: ApiConfig) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const value = request.header("authorization");
    if (!value?.startsWith("Bearer ")) return next(new HttpError(401, "unauthenticated", "A bearer token is required."));
    try {
      request.auth = verifyAccessToken(value.slice(7), config.jwtAccessSecret);
      next();
    } catch {
      next(new HttpError(401, "unauthenticated", "Your session is invalid or expired."));
    }
  };
}
