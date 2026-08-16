import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { createRefreshToken, hashPassword, hashRefreshToken, signAccessToken, verifyPassword } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";

const credentialsSchema = z.object({
  email: z.string().email().max(320).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(256),
  name: z.string().min(1).max(80).optional(),
});

export function createAuthRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();

  router.post("/register", async (request, response, next) => {
    try {
      const input = credentialsSchema.parse(request.body);
      const now = new Date();
      const user = {
        _id: randomUUID() as never,
        email: input.email,
        name: input.name ?? input.email.split("@")[0] ?? "Snappy user",
        passwordHash: await hashPassword(input.password),
        createdAt: now,
        updatedAt: now,
      };
      await database.collections.users.insertOne(user);
      response.status(201).json(await createSession(user._id as string, user.email, config, database));
    } catch (error) {
      if (isDuplicateKey(error)) return next(new HttpError(409, "email_taken", "An account already uses that email address."));
      next(error);
    }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const input = credentialsSchema.pick({ email: true, password: true }).parse(request.body);
      const user = await database.collections.users.findOne({ email: input.email });
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new HttpError(401, "invalid_credentials", "The email or password is incorrect.");
      }
      response.json(await createSession(user._id as string, user.email, config, database));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function createSession(
  userId: string,
  email: string,
  config: ApiConfig,
  database: DatabaseContext,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const refreshToken = createRefreshToken();
  await database.collections.refreshTokens.insertOne({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  return {
    accessToken: signAccessToken({ sub: userId, email }, config.jwtAccessSecret),
    refreshToken,
    expiresIn: 15 * 60,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
