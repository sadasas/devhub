import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { InlineError } from '../components/InlineError';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

export function Input({ label, error, helper, id, className = '', ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`input ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
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
