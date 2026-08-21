import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { McpKeyCreated } from '../../lib/types';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';

// Mirror server cap (audit 2026-08b, KEYS-1)
const MAX_KEYS = 10;

interface NewKeyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (key: McpKeyCreated) => void;
  /** Jumlah key aktif saat ini — untuk peringatan cap (opsional). */
  activeCount?: number;
}

export function NewKeyModal({ open, onClose, onCreated, activeCount = 0 }: NewKeyModalProps) {
  const [step, setStep] = useState<'form' | 'reveal'>('form');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<McpKeyCreated | null>(null);
  const reportedRef = useRef(false);
  const { copied, copy, reset } = useCopyFeedback();

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setName('');
    setError(null);
    setSubmitting(false);
    setCreated(null);
    reportedRef.current = false;
    reset();
  }, [open, reset]);

  // Tutup apa pun caranya (X header, Esc, backdrop, Done) tetap melaporkan key
  // yang sudah dibuat ke parent agar muncul di list (bug: close tanpa Done).
  function handleClose() {
    if (created && !reportedRef.current) {
      reportedRef.current = true;
      onCreated(created);
    }
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const key = await api.createKey(name.trim());
      setCreated(key);
      setStep('reveal');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create key.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    if (!created) return;
    await copy(created.key);
  }

  async function onCopyEnv() {
    if (!created) return;
    await copy(`DEVHUB_MCP_KEY="${created.key}"`);
  }

  function onDone() {
    handleClose();
  }

  const atCapWarning = activeCount >= MAX_KEYS - 1;

  return (
    <Modal
      open={open}
      title="New API key"
      onClose={handleClose}
      width="sm"
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" form="new-key-form" loading={submitting} disabled={!name.trim()}>
              Create key
            </Button>
          </>
        ) : (
          <Button onClick={onDone}>Done</Button>
        )
      }
    >
      {step === 'form' ? (
        <form id="new-key-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label="Name"
            required
            autoFocus
            placeholder="e.g. opencode-desktop"
            helper="Required — so you can tell your keys apart."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="field-helper">
            This key can read and update every project in the teams you belong to. It is shown only
            once — store it somewhere safe.
          </p>
          {atCapWarning && (
            <p className="field-helper field-helper--warn">
              You have {activeCount} of {MAX_KEYS} active keys — the maximum is {MAX_KEYS}. Revoke an
              unused key before creating another.
            </p>
          )}
          {error && <InlineError>{error}</InlineError>}
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
              {copied ? 'Copied' : 'Copy key'}
            </Button>
          </div>

          <div className="code-block">
            <pre>
              <code>{`DEVHUB_MCP_KEY="${created.key}"`}</code>
            </pre>
            <button
              type="button"
              className="code-copy-btn"
              aria-label="Copy as DEVHUB_MCP_KEY environment variable"
              title={copied ? 'Copied' : 'Copy as env var'}
              onClick={() => void onCopyEnv()}
            >
              {copied ? <Check size={13} weight="bold" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            </button>
          </div>

          <p className="field-helper">If you lose it, you can copy it again later from the API keys list.</p>
        </div>
      ) : null}
    </Modal>
  );
}