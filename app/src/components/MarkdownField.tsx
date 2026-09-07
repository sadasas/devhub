import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowsOutSimple, FileText } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarkdownBlocks } from '../lib/markdown';
import { Modal } from './Modal';

interface MarkdownFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  icon?: Icon;
  rows?: number;
  maxLength?: number;
  id?: string;
  /** 'bare' = borderless + autogrow + fokus berarti edit (tanpa toggle). */
  variant?: 'default' | 'bare';
  /** @deprecated Diabaikan — mode bare kini fokus=edit otomatis. Jangan dipakai di kode baru. */
  previewToggle?: boolean;
}

export function MarkdownField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  icon: Icon = FileText,
  rows = 4,
  maxLength = 10000,
  id,
  variant = 'default',
  previewToggle: _previewToggle = false,
}: MarkdownFieldProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
  const bareRef = useRef<HTMLTextAreaElement | null>(null);
  // Autogrow tanpa batas untuk varian bare — yang scroll parent-nya, bukan textarea.
  useLayoutEffect(() => {
    if (variant !== 'bare') return;
    const el = bareRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });

  return (
    <>
      {variant === 'bare' ? (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon size={12} aria-hidden="true" /> {label}
            </span>
            <span className="spacer" />
          </div>
          {editing || value.length === 0 ? (
            <textarea
              ref={bareRef}
              id={id}
              className="textarea-bare"
              rows={1}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => { setFocused(true); setEditing(true); }}
              onBlur={() => { setFocused(false); setEditing(false); }}
              maxLength={maxLength}
              aria-label={label}
            />
          ) : (
            <div
              className="md-preview md-preview-click"
              role="button"
              tabIndex={0}
              aria-label={label}
              onClick={() => {
                setEditing(true);
                requestAnimationFrame(() => bareRef.current?.focus());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setEditing(true);
                  requestAnimationFrame(() => bareRef.current?.focus());
                }
              }}
            >
              {value.trim() ? (
                <MarkdownBlocks text={value} />
              ) : (
                <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
              )}
            </div>
          )}
          <div style={{ marginTop: 6, minHeight: 18 }}>
            {helper && (
              <p className="field-helper" style={{ margin: 0 }}>
                {helper}
              </p>
            )}
            <span
              title={t('project:prd.mdTooltip')}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                visibility: focused ? 'visible' : 'hidden',
              }}
              aria-hidden={!focused}
            >
              {t('project:prd.mdHintShort')}
            </span>
          </div>
        </div>
      ) : (
      <div
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon size={12} aria-hidden="true" /> {label}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
            title={t('tracker:issues.modal.fullscreenAriaDescription')}
            onClick={() => setFullscreen(true)}
          >
            <ArrowsOutSimple size={14} aria-hidden="true" />
          </button>
        </div>
        <textarea
          id={id}
          className="textarea"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          aria-label={label}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 12,
            marginTop: 6,
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {helper && (
              <p className="field-helper" style={{ margin: 0 }}>
                {helper}
              </p>
            )}
            <span
              title={t('project:prd.mdTooltip')}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t('project:prd.mdHintShort')}
            </span>
          </div>
          </div>
        </div>
      )}
      {fullscreen && (
        <Modal
          open
          title={`${label} — Fullscreen`}
          onClose={() => setFullscreen(false)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div
              className="issue-fullscreen-split"
              style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {t('tracker:issues.modal.editTab')}
                </div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={value}
                  autoFocus
                  placeholder={placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  maxLength={maxLength}
                  aria-label={label}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {t('tracker:issues.modal.previewTab')}
                </div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {value.trim() ? (
                    <MarkdownBlocks text={value} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginTop: 8,
                gap: 12,
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <p className="field-helper" style={{ margin: 0 }}>
                  {helper ?? t('tracker:issues.modal.fullscreenHelper')}
                </p>
                <span
                  title={t('project:prd.mdTooltip')}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {t('project:prd.mdHintShort')}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
