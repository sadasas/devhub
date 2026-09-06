import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowsInSimple, ArrowsOutSimple, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";

type ModalWidth = "sm" | "md" | "lg";

let scrollLockDepth = 0;
let scrollRestore: string | null = null;

function lockBodyScroll() {
  if (scrollLockDepth === 0) scrollRestore = document.body.style.overflow;
  scrollLockDepth += 1;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  scrollLockDepth -= 1;
  if (scrollLockDepth <= 0) {
    scrollLockDepth = 0;
    document.body.style.overflow = scrollRestore ?? "";
    scrollRestore = null;
  }
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: ModalWidth;
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  ariaDescribedBy?: string;
  /** Tampilkan tombol expand di header (fullscreen ringan ala composer). */
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  expandLabel?: string;
  collapseLabel?: string;
}

export function Modal({ open, title, onClose, children, footer, width = "md", className, initialFocusRef, ariaDescribedBy, expandable = false, expanded = false, onToggleExpand, expandLabel, collapseLabel }: ModalProps) {
  const titleId = useId();
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(open, initialFocusRef);
  const onCloseRef = useRef(onClose);
  const isFullscreen = className?.includes("modal-fullscreen") ?? false;
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
      className={`modal-backdrop${isFullscreen ? " modal-backdrop--fullscreen" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal modal-${width} ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <div style={{ display: 'flex', gap: 4 }}>
          {expandable && expandLabel && collapseLabel && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon modal-expand-btn"
              onClick={onToggleExpand}
              aria-label={expanded ? collapseLabel : expandLabel}
              aria-pressed={expanded}
              title={expanded ? collapseLabel : expandLabel}
            >
              {expanded ? (
                <ArrowsInSimple size={14} aria-hidden="true" />
              ) : (
                <ArrowsOutSimple size={14} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            disabled={!onClose}
            aria-label={t("action.close")}
          >
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
