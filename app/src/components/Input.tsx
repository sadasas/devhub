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
  showCount: _showCount,
  ['aria-describedby']: ariaDescribedByProp,
  ...rest
}: InputProps) {
  const autoId = useId();
  const errAutoId = useId();
  const helperAutoId = useId();
  const inputId = id ?? autoId;
  const errId = error ? `${inputId}-error` : undefined;
  const helpId = helper && !error ? `${inputId}-helper` : undefined;
  // Use stable generated ids for aria-describedby but tie to inputId for uniqueness
  void errAutoId;
  void helperAutoId;
  const describedBy = [errId, helpId, ariaDescribedByProp].filter(Boolean).join(' ') || undefined;
  const input = (
    <input
      id={inputId}
      className={`input ${error ? 'input-error' : ''} ${className}`}
      aria-invalid={error ? true : undefined}
      aria-required={required ? true : undefined}
      aria-describedby={describedBy}
      required={required}
      {...rest}
    />
  );
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
      {error ? (
        <InlineError id={errId}>{error}</InlineError>
      ) : helper ? (
        <p id={helpId} className="field-helper">{helper}</p>
      ) : null}
    </div>
  );
}
