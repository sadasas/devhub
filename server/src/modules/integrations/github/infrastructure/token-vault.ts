import { encryptKey, decryptKey } from "../../../keys/infrastructure/key-crypto.js";

/**
 * Token vault GitHub — REUSE encryptKey/decryptKey (AES-256-GCM via HKDF dari
 * JWT_SECRET / MCP_KEY_ENC_KEY). JANGAN bikin kripto baru di modul ini.
 *
 * Yang disimpan: installation access token (short-lived 1 jam, di-refresh
 * lazy on-use) + webhook secret (untuk verifikasi HMAC webhook).
 * Token plaintext TIDAK PERNAH di-log.
 */

export function sealToken(raw: string): string {
  if (!raw || raw.length === 0) throw new Error("Cannot seal empty token");
  return encryptKey(raw);
}

export function openToken(blob: string): string {
  if (!blob || blob.length === 0) throw new Error("Invalid token blob");
  return decryptKey(blob);
}

export const sealInstallationToken = sealToken;
export const openInstallationToken = openToken;
export const sealWebhookSecret = sealToken;
export const openWebhookSecret = openToken;
