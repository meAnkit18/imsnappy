import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/lib/crypto.js";

describe("provider-secret encryption", () => {
  const key = Buffer.alloc(32, 7).toString("base64");

  it("round-trips a secret without retaining plaintext in ciphertext", () => {
    const secret = "test-provider-key";
    const payload = encryptSecret(secret, key);
    expect(payload).not.toContain(secret);
    expect(decryptSecret(payload, key)).toBe(secret);
  });

  it("refuses keys that cannot produce AES-256 encryption", () => {
    expect(() => encryptSecret("x", "not-a-valid-key")).toThrow(/32-byte/);
  });
});
