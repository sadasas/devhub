/** Shared body scroll-lock with depth counter (Fase 2).
 *  Dipakai Modal + Drawer agar nested (drawer edit + confirm delete di atasnya)
 *  tidak membuka kunci scroll prematur saat dialog atas ditutup.
 */
let scrollLockDepth = 0;
let scrollRestore: string | null = null;

export function lockBodyScroll(): void {
  if (scrollLockDepth === 0) scrollRestore = document.body.style.overflow;
  scrollLockDepth += 1;
  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  scrollLockDepth -= 1;
  if (scrollLockDepth <= 0) {
    scrollLockDepth = 0;
    document.body.style.overflow = scrollRestore ?? '';
    scrollRestore = null;
  }
}
