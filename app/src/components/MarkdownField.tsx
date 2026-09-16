import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowsOutSimple, FileText } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MarkdownBlocks } from '../lib/markdown';
import { Modal } from './Modal';

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

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
            <span className="md-inline-icon">
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
          <div className="md-meta">
            {helper && (
              <p className="field-helper md-helper-reset">
                {helper}
              </p>
            )}
            <span
              title={t('project:prd.mdTooltip')}
              className={focused ? 'md-hint' : 'md-hint md-hint-hidden'}
              aria-hidden={!focused}
            >
              {t('project:prd.mdHintShort')}
            </span>
          </div>
        </div>
      ) : (
      <div className="md-box">
        <div className="md-box-head">
          <span className="md-inline-icon">
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
        <div className="md-foot">
          <div className="md-foot-main">
            {helper && (
              <p className="field-helper md-helper-reset">
                {helper}
              </p>
            )}
            <span
              title={t('project:prd.mdTooltip')}
              className="md-hint"
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
          title={t('tracker:issues.modal.fullscreenTitle', { label })}
          onClose={() => setFullscreen(false)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div
              className="issue-fullscreen-split"
            >
              <div className="md-split-pane">
                <div className="md-split-head">
                  {t('tracker:issues.modal.editTab')}
                </div>
                <textarea
                  className="textarea md-split-area"
                  value={value}
                  autoFocus={AUTO_FOCUS_INPUT}
                  placeholder={placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  maxLength={maxLength}
                  aria-label={label}
                />
              </div>
              <div className="md-split-pane">
                <div className="md-split-head">
                  {t('tracker:issues.modal.previewTab')}
                </div>
                <div className="md-preview md-split-preview">
                  {value.trim() ? (
                    <MarkdownBlocks text={value} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="md-split-foot">
              <div className="md-foot-main">
                <p className="field-helper md-helper-reset">
                  {helper ?? t('tracker:issues.modal.fullscreenHelper')}
                </p>
                <span
                  title={t('project:prd.mdTooltip')}
                  className="md-hint"
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
