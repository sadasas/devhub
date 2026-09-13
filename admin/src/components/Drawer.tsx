import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { lockBodyScroll, unlockBodyScroll } from "../lib/scroll-lock";

interface DrawerProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Drawer kanan slide-over (Fase 2): pengganti Modal tengah untuk form edit.
 *  Modal hanya untuk confirm/delete. Kontrak sama dengan Modal:
 *  focus-trap + Esc + restore fokus + aria-modal + scroll-lock bersama.
 */
export function Drawer({ open, title, onClose, children, footer, className, initialFocusRef }: DrawerProps) {
  const titleId = useId();
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(open, initialFocusRef);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.scrollTo?.(0, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, dialogRef]);

  if (!open) return null;

  return createPortal(
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`drawer ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="drawer-header">
          <h2 id={titleId} className="drawer-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            disabled={!onClose}
            aria-label={t("action.close")}
          >
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
