import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface CtxMenuItem {
  id: string;
  label: string;
  /** Display-only shortcut hint (e.g. Ctrl+C) — shown only when the binding exists. */
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  run: () => void;
}

interface WhiteboardContextMenuProps {
  x: number;
  y: number;
  sections: CtxMenuItem[][];
  onClose: () => void;
}

/**
 * FigJam-style right-click object menu (Image 4): dark grouped menu, shortcut
 * hints right-aligned. Actions reuse the canvas floating-bar callbacks.
 */
export function WhiteboardContextMenu({ x, y, sections, onClose }: WhiteboardContextMenuProps) {
  const { t } = useTranslation('extras');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    rootRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const left = typeof window === 'undefined' ? x : Math.max(8, Math.min(x, window.innerWidth - 256));
  const top = typeof window === 'undefined' ? y : Math.max(8, Math.min(y, window.innerHeight - 420));

  return (
    <div
      ref={rootRef}
      className="wb-ctxmenu"
      role="menu"
      aria-label={t('whiteboard.ctx.menu')}
      tabIndex={-1}
      style={{ left, top }}
    >
      {sections.map((items, si) => (
        <div key={si} className="wb-ctxsec" role="none">
          {si > 0 && <div className="wb-ctxsep" role="separator" aria-hidden="true" />}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`wb-ctxrow${item.danger ? ' wb-ctxrow-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                item.run();
                onClose();
              }}
            >
              <span className="wb-ctxname">{item.label}</span>
              {item.shortcut && (
                <>
                  {' '}
                  <span className="wb-ctxkey">{item.shortcut}</span>
                </>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
