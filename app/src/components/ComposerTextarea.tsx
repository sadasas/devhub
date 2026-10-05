import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, MutableRefObject, Ref } from 'react';
import { PencilSimple } from '@phosphor-icons/react';

interface ComposerTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter tanpa Shift (submit). Tanpa handler = Enter baris baru. */
  onSubmit?: () => void;
  /** Escape. */
  onCancel?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  required?: boolean;
  rows?: number;
  /** Cap tinggi autogrow (mis. 160 untuk chat). Tanpa cap = tanpa batas. */
  maxHeight?: number;
  spellCheck?: boolean;
  autoCorrect?: string;
  autoCapitalize?: string;
  className?: string;
  style?: CSSProperties;
  /** Style untuk wrapper (mis. flex layout baris) — style tetap milik textarea. */
  wrapStyle?: CSSProperties;
  textareaRef?: Ref<HTMLTextAreaElement>;
  /** Hint pensil hover-reveal (default tampil — semua composer terhint otomatis). */
  hint?: boolean;
}

/**
 * ComposerTextarea — textarea bare autogrow terpadu.
 * Menggantikan pola `scrollHeight` yang diduplikasi di ±14 titik
 * (TaskDetail, FocusTaskDetail, New*Modal, ChatPanel, ...).
 * Gaya default = `.composer-title` (borderless + hairline focus cue,
 * bukan halo) — tanpa CSS/visual baru.
 */
export function ComposerTextarea({
  value,
  onChange,
  onSubmit,
  onCancel,
  onBlur,
  placeholder,
  ariaLabel,
  invalid,
  maxLength,
  autoFocus,
  required,
  rows = 1,
  maxHeight,
  spellCheck,
  autoCorrect,
  autoCapitalize,
  className = 'composer-title',
  style,
  wrapStyle,
  textareaRef,
  hint = true,
}: ComposerTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = el.scrollHeight;
    el.style.height = maxHeight != null ? `${Math.min(h, maxHeight)}px` : `${h}px`;
  });

  return (
    <span className="composer-hint" style={wrapStyle}>
      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof textareaRef === 'function') textareaRef(el);
          else if (textareaRef) (textareaRef as MutableRefObject<HTMLTextAreaElement | null>).current = el;
        }}
        className={className}
        rows={rows}
        value={value}
        maxLength={maxLength}
        required={required}
        spellCheck={spellCheck}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
            e.preventDefault();
            onSubmit();
          } else if (e.key === 'Escape' && onCancel) {
            onCancel();
          }
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        style={style}
      />
      {hint && <PencilSimple size={12} aria-hidden="true" className="editable-pencil" />}
    </span>
  );
}
