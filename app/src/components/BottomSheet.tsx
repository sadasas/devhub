import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";

let sheetLockDepth = 0;
let sheetScrollRestore: string | null = null;

function lockSheetScroll() {
  if (sheetLockDepth === 0) sheetScrollRestore = document.body.style.overflow;
  sheetLockDepth += 1;
  document.body.style.overflow = "hidden";
}

function unlockSheetScroll() {
  sheetLockDepth -= 1;
  if (sheetLockDepth <= 0) {
    sheetLockDepth = 0;
    document.body.style.overflow = sheetScrollRestore ?? "";
    sheetScrollRestore = null;
  }
}

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  withHandle?: boolean;
  withOverlay?: boolean;
  hideHeader?: boolean;
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  footer,
  withHandle = true,
  withOverlay = true,
  hideHeader = false,
}: BottomSheetProps) {
  const titleId = useId();
  const { t } = useTranslation();
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    lockSheetScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockSheetScroll();
    };
  }, [open, dialogRef]);

  if (!open) return null;

  const sheet = (
    <div
      ref={dialogRef}
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {withHandle && <div className="sheet-handle" aria-hidden="true" />}
      {hideHeader ? (
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
      ) : (
        <header className="sheet-header">
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label={t("action.close")}
          >
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
        </header>
      )}
      <div className="sheet-body">{children}</div>
      {footer && <footer className="sheet-footer-sticky">{footer}</footer>}
    </div>
  );

  if (!withOverlay) {
    return createPortal(sheet, document.body);
  }

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {sheet}
    </div>,
    document.body,
  );
}
