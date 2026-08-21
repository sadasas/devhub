import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { config } from '../../../config.js';

/**
 * Enkripsi raw MCP key untuk re-reveal (audit 2026-08b, fitur copy full key).
 *
 * AES-256-GCM; kunci diturunkan dari JWT_SECRET via HKDF-SHA256 sehingga tidak
 * butuh env baru. Format tersimpan: `iv.base64.tag.base64.ciphertext.base64`.
 *
 * Risiko terdokumentasi (security-design.md): bila DB DAN JWT_SECRET bocor,
 * key dapat didekripsi. Rotasi JWT_SECRET membuat reveal key lama gagal.
 */

const ENC_SALT = Buffer.alloc(32, 0x64); // 'devhub-mcp-key-enc' context salt
const CONTEXT = Buffer.from('devhub-mcp-key-enc', 'utf8');
const IV_LEN = 12;

function encryptionKey(): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(config.JWT_SECRET, 'utf8'), ENC_SALT, CONTEXT, 32),
  );
}

export function encryptKey(raw: string): string {
  const key = encryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptKey(blob: string): string {
  const parts = blob.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted key blob');
  const [ivB64, tagB64, ctB64] = parts;
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Invalid encrypted key blob');
  const key = encryptionKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}