const PALETTE_EVENT = 'devhub:open-palette';

export function openPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT));
}

export function onOpenPalette(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(PALETTE_EVENT, handler);
  return () => window.removeEventListener(PALETTE_EVENT, handler);
}