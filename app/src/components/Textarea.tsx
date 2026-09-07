import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { InlineError } from '../components/InlineError';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helper?: string;
  showCount?: boolean;
}

export function Textarea({ label, error, helper, id, className = '', required, showCount: _showCount, ...rest }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const errId = error ? `${textareaId}-error` : undefined;
  const helpId = helper && !error ? `${textareaId}-helper` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined;
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
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
      {error ? (
        <InlineError id={errId}>{error}</InlineError>
      ) : helper ? (
        <p id={helpId} className="field-helper">{helper}</p>
      ) : null}
    </div>
  );
}
