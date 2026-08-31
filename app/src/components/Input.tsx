import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { InlineError } from '../components/InlineError';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
  rightSlot?: ReactNode;
  showCount?: boolean;
}

export function Input({
  label,
  error,
  helper,
  id,
  className = '',
  required,
  rightSlot,
  showCount,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <input
      id={inputId}
      className={`input ${error ? 'input-error' : ''} ${className}`}
      aria-invalid={error ? true : undefined}
      aria-required={required ? true : undefined}
      required={required}
      {...rest}
    />
  );
  const max = rest.maxLength;
  const rawValue = (rest.value as unknown) ?? (rest.defaultValue as unknown) ?? '';
  const count = String(rawValue).length;
  const showCounter = Boolean(showCount && typeof max === 'number' && max > 0);
  const countColor =
    showCounter && count > Math.floor((max as number) * 0.9)
      ? 'var(--status-danger)'
      : showCounter && count > Math.floor((max as number) * 0.8)
        ? 'var(--status-warn)'
        : 'var(--text-muted)';
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {required && (
          <span className="field-required" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {rightSlot ? (
        <div className="input-slot-wrap">
          {input}
          <span className="input-slot">{rightSlot}</span>
        </div>
      ) : (
        input
      )}
      {showCounter ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {error ? (
              <InlineError>{error}</InlineError>
            ) : helper ? (
              <p className="field-helper" style={{ margin: 0 }}>{helper}</p>
            ) : null}
          </div>
          <span style={{ fontSize: 11, color: countColor, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>{count.toLocaleString()} / {(max as number).toLocaleString()}</span>
        </div>
      ) : error ? (
        <InlineError>{error}</InlineError>
      ) : helper ? (
        <p className="field-helper">{helper}</p>
      ) : null}
    </div>
  );
}
