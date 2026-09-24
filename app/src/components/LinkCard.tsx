import { useEffect, useState } from 'react';
import { LinkSimple } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { faviconFor, linkDomain } from '../lib/attachmentPreview';
import type { Attachment } from '../lib/types';

/**
 * Kartu link ala Linear: favicon + judul + domain/deskripsi + thumbnail OG.
 * Data dari GET /attachments/unfurl (SSRF-guarded, cached 1 jam).
 * Gagal fetch → fallback domain + favicon agar kartu tidak pecah.
 */

interface UnfurlData {
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  fallback: boolean;
}

const unfurlCache = new Map<string, UnfurlData>();

export function LinkCard({ attachment }: { attachment: Attachment }) {
  const href = attachment.url ?? '';
  const domain = linkDomain(href);
  const [data, setData] = useState<UnfurlData | null>(() => (href ? (unfurlCache.get(href) ?? null) : null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!href || unfurlCache.has(href)) return;
    let cancelled = false;
    setLoading(true);
    api
      .attachmentUnfurl(href)
      .then((res) => {
        unfurlCache.set(href, res);
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [href]);

  const title = data?.title || attachment.name;
  const desc = data?.description || domain;
  const favicon = data?.favicon ?? faviconFor(href);
  const image = data?.image ?? null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="link-card"
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '6px 0',
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
      }}
      title={href}
    >
      {favicon ? (
        <img
          src={favicon}
          alt=""
          aria-hidden="true"
          width={16}
          height={16}
          loading="lazy"
          style={{ flexShrink: 0, marginTop: 2, borderRadius: 3 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <LinkSimple size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-muted)' }} />
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--text-ui)',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {loading
            ? attachment.name
            : title}
        </span>
        {desc && (
          <span
            style={{
              display: 'block',
              fontSize: 'var(--text-caption)',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {desc}
          </span>
        )}
      </span>
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
    </a>
  );
}
