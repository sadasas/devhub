import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { InlineError } from '../components/InlineError';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helper?: string;
}

export function Textarea({ label, error, helper, id, className = '', required, ...rest }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
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
