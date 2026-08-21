import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX = 'devhub_';

export interface GeneratedMcpKey {
  raw: string;
  keyHash: string;
  prefix: string;
}

export function generateMcpKey(): GeneratedMcpKey {
  const raw = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    raw,
    keyHash: hashMcpKey(raw),
    prefix: raw.slice(0, 8),
  };
}

export function hashMcpKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
