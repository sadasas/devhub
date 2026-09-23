import { describe, expect, it } from 'vitest';
import {
  attachmentRef,
  faviconFor,
  isPreviewable,
  linkDomain,
  parseAttachmentRef,
  previewKind,
} from './attachmentPreview';

describe('attachmentPreview', () => {
  it('classifies Linear-style preview kinds', () => {
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('IMAGE/JPEG')).toBe('image');
    expect(previewKind('video/mp4')).toBe('video');
    expect(previewKind('video/webm')).toBe('video');
    expect(previewKind('application/pdf')).toBe('pdf');
    expect(previewKind('text/plain')).toBe('text');
    expect(previewKind('application/json')).toBe('text');
    expect(previewKind('application/zip')).toBeNull();
    expect(previewKind('')).toBeNull();
    expect(previewKind(null)).toBeNull();
  });

  it('marks only devhub allowlist types as previewable', () => {
    expect(isPreviewable('image/png')).toBe(true);
    expect(isPreviewable('video/mp4')).toBe(true);
    expect(isPreviewable('application/zip')).toBe(false);
    expect(isPreviewable('')).toBe(false);
  });

  it('extracts link domains and favicons for rich cards', () => {
    expect(linkDomain('https://github.com/org/repo/pull/1')).toBe('github.com');
    expect(linkDomain('notaurl')).toBe('');
    expect(linkDomain(null)).toBe('');
    expect(faviconFor('https://github.com/x')).toContain('github.com');
    expect(faviconFor(null)).toBeNull();
  });

  it('round-trips attachment embed refs', () => {
    const ref = attachmentRef('abc123', 'ss.png');
    expect(ref).toBe('![ss.png](attachment:abc123)');
    expect(parseAttachmentRef('attachment:abc123')).toBe('abc123');
    expect(parseAttachmentRef('https://x.test/a.png')).toBeNull();
    expect(parseAttachmentRef('attachment:')).toBeNull();
  });
});
