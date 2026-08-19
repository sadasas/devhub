import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { InlineError } from '../components/InlineError';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
  rightSlot?: ReactNode;
}

export function Input({
  label,
  error,
  helper,
  id,
  className = '',
  required,
  rightSlot,
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
        <InlineError>
          {error}
        </InlineError>
      ) : helper ? (
        <p className="field-helper">{helper}</p>
      ) : null}
    </div>
  );
}
