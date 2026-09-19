import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey } from "../src/modules/keys/infrastructure/key-crypto.js";
import {
  openToken,
  sealToken,
} from "../src/modules/integrations/gcal/infrastructure/token-vault.js";

describe("gcal token vault (reuse key-crypto)", () => {
  it("round-trips refresh token via seal/open", () => {
    const raw = "1//0g-test-refresh-token-abc123";
    const blob = sealToken(raw);
    expect(blob).not.toContain(raw);
    expect(blob.split(".")).toHaveLength(3);
    expect(openToken(blob)).toBe(raw);
  });

  it("round-trips access token and differs per encryption (random IV)", () => {
    const raw = "ya29.test-access-token";
    const a = sealToken(raw);
    const b = sealToken(raw);
    expect(a).not.toBe(b);
    expect(openToken(a)).toBe(raw);
    expect(openToken(b)).toBe(raw);
  });

  it("vault reuses key-crypto blob format (interoperable)", () => {
    const raw = "1//interop-check";
    const viaVault = sealToken(raw);
    expect(decryptKey(viaVault)).toBe(raw);
    const viaCrypto = encryptKey(raw);
    expect(openToken(viaCrypto)).toBe(raw);
  });

  it("rejects empty token and garbage blob", () => {
    expect(() => sealToken("")).toThrow();
    expect(() => openToken("")).toThrow();
    expect(() => openToken("not-a-blob")).toThrow();
  });
});
