import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "../src/lib/auth.js";

describe("access tokens", () => {
  const secret = "a".repeat(64);

  it("binds a token to a user and email", () => {
    const token = signAccessToken({ sub: "user-1", email: "user@example.test" }, secret);
    expect(verifyAccessToken(token, secret)).toMatchObject({ sub: "user-1", email: "user@example.test", type: "access" });
  });
});
