import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

const PRINT_SETTLE_MS = 400;

export function buildApiPdfTitle(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? 'devhub-' + slug + '-api' : 'devhub-api';
}

function appendStyles(doc: Document): void {
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode;
    if (owner instanceof HTMLLinkElement && owner.href) {
      try {
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL(owner.href, document.baseURI).toString();
        if (owner.media) link.media = owner.media;
        doc.head.appendChild(link);
      } catch {
        /* skip unparseable hrefs */
      }
    } else if (owner instanceof HTMLStyleElement) {
      // Vite dev injects styles as <style> tags (no link href to clone).
      const style = doc.createElement('style');
      if (owner.media) style.media = owner.media;
      style.textContent = owner.textContent ?? '';
      doc.head.appendChild(style);
    }
  }
}

/**
 * Render a docs node into a hidden same-origin iframe and open the native
 * print dialog (vector output, zero dependencies). Restores the document
 * title and removes the iframe once printing finishes.
 */
export function printApiNode(node: ReactNode, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  const prevTitle = document.title;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      root.unmount();
    } catch {
      /* already unmounted */
    }
    iframe.remove();
    document.title = prevTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  // Ink-friendly print: reuse the app's own light tokens.
  doc.documentElement.setAttribute('data-theme', 'light');
  appendStyles(doc);
  const mount = doc.createElement('div');
  mount.className = 'api-print-mount';
  doc.body.appendChild(mount);
  const root = createRoot(mount);
  root.render(node);
  document.title = title;
  window.addEventListener('afterprint', cleanup);
  window.setTimeout(() => {
    try {
      if (typeof win.print === 'function') win.print();
      else cleanup();
    } catch {
      cleanup();
    }
  }, PRINT_SETTLE_MS);
}