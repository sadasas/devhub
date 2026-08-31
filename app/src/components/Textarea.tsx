import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { InlineError } from '../components/InlineError';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helper?: string;
  showCount?: boolean;
}

export function Textarea({ label, error, helper, id, className = '', required, showCount, ...rest }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
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
      <label className="field-label" htmlFor={textareaId}>
        {label}
        {required && (
          <span className="field-required" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      <textarea
        id={textareaId}
        className={`textarea ${error ? 'textarea-error' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        required={required}
        {...rest}
      />
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
