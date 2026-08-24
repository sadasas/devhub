import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { Check, Copy } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('account');
  const [step, setStep] = useState<'form' | 'reveal'>('form');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<McpKeyCreated | null>(null);
  const reportedRef = useRef(false);
  const { copied, copy, reset } = useCopyFeedback();
  const { copied: curlCopied, copy: copyCurl } = useCopyFeedback();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlSnippet = `curl -X POST ${origin}/mcp \\
  -H "Authorization: Bearer $DEVHUB_MCP_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

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
      setError(getErrorMessage(err, t('keys.error.createFailed')));
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

  async function onCopyCurl() {
    await copyCurl(curlSnippet);
  }

  function onDone() {
    handleClose();
  }

  const atCapWarning = activeCount >= MAX_KEYS - 1;

  return (
    <Modal
      open={open}
      title={t('keys.newKeyModal.title')}
      onClose={handleClose}
      width="sm"
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              {t('common:action.cancel')}
            </Button>
            <Button type="submit" form="new-key-form" loading={submitting} disabled={!name.trim()}>
              {t('keys.newKeyModal.create')}
            </Button>
          </>
        ) : (
          <Button onClick={onDone}>{t('keys.newKeyModal.done')}</Button>
        )
      }
    >
      {step === 'form' ? (
        <form id="new-key-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label={t('keys.newKeyModal.name')}
            required
            autoFocus
            placeholder={t('keys.newKeyModal.namePlaceholder')}
            helper={t('keys.newKeyModal.nameHelper')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="field-helper">
            {t('keys.newKeyModal.scopeNote')}
          </p>
          {atCapWarning && (
            <p className="field-helper field-helper--warn">
              {t('keys.newKeyModal.capWarning', { active: activeCount, max: MAX_KEYS })}
            </p>
          )}
          {error && <InlineError>{error}</InlineError>}
        </form>
      ) : created ? (
        <div className="form-stack">
          <p className="field-helper">{t('keys.newKeyModal.copyNow')}</p>
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
              {copied ? t('keys.copied') : t('keys.newKeyModal.copyKey')}
            </Button>
          </div>

          <div className="code-block">
            <pre>
              <code>{`DEVHUB_MCP_KEY="${created.key}"`}</code>
            </pre>
            <button
              type="button"
              className="code-copy-btn"
              aria-label={t('keys.newKeyModal.envVarAria')}
              title={copied ? t('keys.copied') : t('keys.newKeyModal.envVarTitle')}
              onClick={() => void onCopyEnv()}
            >
              {copied ? <Check size={13} weight="bold" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            </button>
          </div>

          <p className="field-helper">{t('keys.newKeyModal.loseNote')}</p>

          <p className="field-helper">{t('keys.newKeyModal.nextSteps')}</p>
          <div className="code-block">
            <pre>
              <code>{curlSnippet}</code>
            </pre>
            <button
              type="button"
              className="code-copy-btn"
              aria-label={t('keys.newKeyModal.curlAria')}
              title={curlCopied ? t('keys.copied') : t('keys.copy')}
              onClick={() => void onCopyCurl()}
            >
              {curlCopied ? (
                <Check size={13} weight="bold" aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="field-helper">
            <Link to="/docs/mcp">{t('keys.fullGuide')}</Link>
          </p>
        </div>
      ) : null}
    </Modal>
  );
}