import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, ListChecks, ArrowsOutSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { TestCaseStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';

interface NewTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTestModal({ open, onClose }: NewTestModalProps) {
  const { state, dispatch } = useProject();
  const { t } = useTranslation(['tracker','project']);
  usePresenceStatus(t('tests.newModal.presenceCreating'), open);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TestCaseStatus>('pending');
  const [taskId, setTaskId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [fullscreenField, setFullscreenField] = useState<'steps' | 'expected' | null>(null);
  const [preview, setPreview] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) {
      setName('');
      setStatus('pending');
      setTaskId('');
      setIssueId('');
      setSteps('');
      setExpected('');
      setFullscreenField(null);
      setPreview({});
    }
  }, [open]);

  if (!state) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'testCase/add',
      testCase: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        status,
        taskId: taskId || null,
        issueId: issueId || null,
        steps: steps.trim(),
        expected: expected.trim(),
      },
    });
    setName('');
    setStatus('pending');
    setTaskId('');
    setIssueId('');
    setSteps('');
    setExpected('');
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        title={t('tests.newModal.title')}
        onClose={onClose}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('tests.newModal.cancel')}
            </Button>
            <Button type="submit" form="new-test-form" disabled={!name.trim()}>
              {t('tests.newModal.submit')}
            </Button>
          </>
        }
      >
        <form id="new-test-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label={t('tests.newModal.nameLabel')}
            required
            autoFocus
            placeholder={t('tests.newModal.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={300}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <ListChecks size={12} aria-hidden="true" /> {t('tests.newModal.statusLabel')}
              </span>
              <select
                id="new-test-status"
                className="select"
                style={{ width: 160 }}
                value={status}
                onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
              >
                <option value="pending">{t('tests.status.pending')}</option>
                <option value="pass">{t('tests.status.pass')}</option>
                <option value="fail">{t('tests.status.fail')}</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <FileText size={12} aria-hidden="true" /> {t('tests.newModal.linkedTaskLabel')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  id="new-test-task"
                  label=""
                  value={taskId || null}
                  options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
                  onChange={(v) => setTaskId(v ?? '')}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
              <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <FileText size={12} aria-hidden="true" /> {t('tests.newModal.linkedIssueLabel')}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  id="new-test-issue"
                  label=""
                  value={issueId || null}
                  options={state.issues.map((i) => ({ value: i.id, label: i.title }))}
                  onChange={(v) => setIssueId(v ?? '')}
                />
              </div>
            </div>

            {/* Steps card */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ListChecks size={12} aria-hidden="true" /> {t('tests.newModal.stepsLabel')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {steps.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t('tests.newModal.stepsLabel') })}>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.steps ? '' : ' active'}`}
                        aria-pressed={!preview.steps}
                        onClick={() => setPreview((p) => ({ ...p, steps: false }))}
                      >
                        {t('project:prd.edit')}
                      </button>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.steps ? ' active' : ''}`}
                        aria-pressed={!!preview.steps}
                        onClick={() => setPreview((p) => ({ ...p, steps: true }))}
                      >
                        {t('project:prd.preview')}
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                    title={t('tracker:issues.modal.fullscreenAriaDescription')}
                    onClick={() => setFullscreenField('steps')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {preview.steps ? (
                <div className="md-preview">
                  {steps.trim() ? (
                    <MarkdownBlocks text={steps} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              ) : (
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder={t('tests.newModal.stepsPlaceholder')}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  maxLength={10000}
                  aria-label={t('tests.newModal.stepsLabel')}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: steps.length > 9000 ? 'var(--status-danger)' : steps.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {steps.length.toLocaleString()} / {(10000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Expected card */}
            <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={12} aria-hidden="true" /> {t('tests.newModal.expectedLabel')}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {expected.trim() && (
                    <span className="md-toggle" role="group" aria-label={t('project:prd.modeAria', { label: t('tests.newModal.expectedLabel') })}>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.expected ? '' : ' active'}`}
                        aria-pressed={!preview.expected}
                        onClick={() => setPreview((p) => ({ ...p, expected: false }))}
                      >
                        {t('project:prd.edit')}
                      </button>
                      <button
                        type="button"
                        title={t('project:prd.mdTooltip')}
                        className={`md-toggle-btn${preview.expected ? ' active' : ''}`}
                        aria-pressed={!!preview.expected}
                        onClick={() => setPreview((p) => ({ ...p, expected: true }))}
                      >
                        {t('project:prd.preview')}
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    aria-label={t('tracker:issues.modal.fullscreenAriaDescription')}
                    title={t('tracker:issues.modal.fullscreenAriaDescription')}
                    onClick={() => setFullscreenField('expected')}
                  >
                    <ArrowsOutSimple size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>
              {preview.expected ? (
                <div className="md-preview">
                  {expected.trim() ? (
                    <MarkdownBlocks text={expected} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              ) : (
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder={t('tests.newModal.expectedPlaceholder')}
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  maxLength={5000}
                  aria-label={t('tests.newModal.expectedLabel')}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: expected.length > 4500 ? 'var(--status-danger)' : expected.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {expected.length.toLocaleString()} / {(5000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>
      {fullscreenField === 'steps' && (
        <Modal
          open
          title={`${t('tests.newModal.stepsLabel')} — Fullscreen`}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={steps}
                  autoFocus
                  placeholder={t('tests.newModal.stepsPlaceholder')}
                  onChange={(e) => setSteps(e.target.value)}
                  maxLength={10000}
                  aria-label={t('tests.newModal.stepsLabel')}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {steps.trim() ? (
                    <MarkdownBlocks text={steps} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
              <span style={{ fontSize: 11, color: steps.length > 9000 ? 'var(--status-danger)' : steps.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {steps.length.toLocaleString()} / {(10000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
      {fullscreenField === 'expected' && (
        <Modal
          open
          title={`${t('tests.newModal.expectedLabel')} — Fullscreen`}
          onClose={() => setFullscreenField(null)}
          width="lg"
          className="modal-fullscreen"
        >
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea
                  className="textarea"
                  style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }}
                  value={expected}
                  autoFocus
                  placeholder={t('tests.newModal.expectedPlaceholder')}
                  onChange={(e) => setExpected(e.target.value)}
                  maxLength={5000}
                  aria-label={t('tests.newModal.expectedLabel')}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {expected.trim() ? (
                    <MarkdownBlocks text={expected} />
                  ) : (
                    <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{t('tracker:issues.modal.fullscreenHelper')}</p>
              <span style={{ fontSize: 11, color: expected.length > 4500 ? 'var(--status-danger)' : expected.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {expected.length.toLocaleString()} / {(5000).toLocaleString()}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
