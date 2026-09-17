import { encryptKey, decryptKey } from "../../../keys/infrastructure/key-crypto.js";

/**
 * Token vault GCal — REUSE encryptKey/decryptKey (AES-256-GCM via HKDF dari
 * JWT_SECRET / MCP_KEY_ENC_KEY). JANGAN bikin kripto baru di modul ini.
 *
 * Format blob: `iv.base64.tag.base64.ciphertext.base64` (lihat key-crypto.ts).
 * Modul ini hanya alias semantik agar call-site GCal eksplisit tanpa
 * menduplikasi primitive kripto.
 */

export function sealToken(raw: string): string {
  if (!raw || raw.length === 0) throw new Error("Cannot seal empty token");
  return encryptKey(raw);
}

export function openToken(blob: string): string {
  if (!blob || blob.length === 0) throw new Error("Invalid token blob");
  return decryptKey(blob);
}

/** Alias semantik — refresh & access memakai vault yang sama. */
export const sealRefreshToken = sealToken;
export const openRefreshToken = openToken;
export const sealAccessToken = sealToken;
export const openAccessToken = openToken;
