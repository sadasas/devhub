import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import type { McpKeyCreated } from '../../lib/types';
import { copyText } from '../../lib/utils';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

interface NewKeyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (key: McpKeyCreated) => void;
}

export function NewKeyModal({ open, onClose, onCreated }: NewKeyModalProps) {
  const [step, setStep] = useState<'form' | 'reveal'>('form');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<McpKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setName('');
    setError(null);
    setSubmitting(false);
    setCreated(null);
    setCopied(false);
  }, [open]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const key = await api.createKey(name.trim() || undefined);
      setCreated(key);
      setStep('reveal');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create key.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    if (!created) return;
    const ok = await copyText(created.key);
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  function onDone() {
    if (created) onCreated(created);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="New API key"
      onClose={onClose}
      width="sm"
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="new-key-form" loading={submitting}>
              Create key
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onDone}>Done</Button>
          </>
        )
      }
    >
      {step === 'form' ? (
        <form id="new-key-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label="Name"
            autoFocus
            placeholder="e.g. opencode-desktop"
            helper="Optional — so you can tell your keys apart."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : created ? (
        <div className="form-stack">
          <p className="field-helper">Copy this key now — it is shown only once.</p>
          <div className="key-raw-box">
            <code className="key-raw-value">{created.key}</code>
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                copied ? (
                  <Check size={14} weight="bold" aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )
              }
              onClick={() => void onCopy()}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="field-helper">If you lose it, revoke this key and create a new one.</p>
        </div>
      ) : null}
    </Modal>
  );
}
