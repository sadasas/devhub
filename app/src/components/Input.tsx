import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { InlineError } from '../components/InlineError';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

export function Input({ label, error, helper, id, className = '', required, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
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
      <input
        id={inputId}
        className={`input ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        required={required}
        {...rest}
      />
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
