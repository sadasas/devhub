import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface DetailShellProps {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  sidebarHead?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  /** Elemen tambahan setelah modal (mis. dialog konfirmasi hapus). */
  after?: ReactNode;
}

/**
 * Kerangka modal edit terpadu: Modal composer + kolom utama +
 * sidebar properti sticky + footer. Dipakai semua modal edit entitas.
 * P0 mobile: width lg (modal-composer--fullscreen, 840px) otomatis menjadi
 * fullscreen sheet di <=640px via global.css (tanpa horizontal scroll).
 */
export function DetailShell({
  title,
  onClose,
  footer,
  sidebarHead,
  sidebar,
  children,
  after,
}: DetailShellProps) {
  return (
    <>
      <Modal
        open
        title={title}
        onClose={onClose}
        width="lg"
        className="modal-composer modal-composer--fullscreen"
        footer={footer}
      >
        <div className="composer-scroll">
          <div className="detail-grid">
            <aside className="detail-side">
              {sidebarHead != null && <div className="propside-head">{sidebarHead}</div>}
              {sidebar}
            </aside>
            <div className="detail-main">{children}</div>
          </div>
        </div>
      </Modal>
      {after}
    </>
  );
}
