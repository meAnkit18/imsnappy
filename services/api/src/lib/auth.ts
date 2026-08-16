import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export interface AccessClaims {
  sub: string;
  email: string;
  type: "access";
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createRefreshToken(): string {
  return `${randomUUID()}.${randomUUID()}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algorithm, salt, expectedEncoded] = hash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedEncoded) return false;
  const expected = Buffer.from(expectedEncoded, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signAccessToken(claims: Omit<AccessClaims, "type">, secret: string): string {
  return jwt.sign({ ...claims, type: "access" }, secret, { algorithm: "HS256", expiresIn: "15m" });
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof payload === "string" || payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid access token");
  }
  return { sub: payload.sub, email: payload.email, type: "access" };
}
