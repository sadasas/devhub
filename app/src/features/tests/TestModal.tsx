import { useEffect, useState } from 'react';
import { Trash, FileText, ListChecks, ArrowsOutSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { TestCase, TestCaseStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';

type ActiveField = 'name' | 'status' | 'task' | 'issue' | 'steps' | 'expected' | null;

interface TestModalProps {
  testId: string | null;
  onClose: () => void;
}

export function TestModal({ testId, onClose }: TestModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fullscreenField, setFullscreenField] = useState<ActiveField>(null);
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const { t } = useTranslation(['tracker', 'project']);

  useEffect(() => {
    setActiveField(null);
    setConfirmOpen(false);
    setFullscreenField(null);
    setPreview({});
  }, [testId]);

  const test = testId ? state?.testCases.find((x) => x.id === testId) : undefined;
  usePresenceStatus(t('tests.modal.presenceEditing'), test != null);
  if (!state || !test) return null;

  const update = (patch: UpdatePatch<TestCase>) => {
    dispatch({ type: 'testCase/update', id: test.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'testCase/remove', id: test.id });
    onClose();
  };

  const linkedTask = test.taskId ? state.tasks.find((x) => x.id === test.taskId) : undefined;
  const linkedIssue = test.issueId ? state.issues.find((x) => x.id === test.issueId) : undefined;

  return (
    <>
      <Modal
        open={testId !== null}
        title={t('tests.modal.viewTitle')}
        onClose={fullscreenField ? () => setFullscreenField(null) : onClose}
        width="lg"
        footer={
          canEdit ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('tests.modal.delete')}
            </Button>
          ) : undefined
        }
      >
        <div className="form-stack">
          <>
            {/* Name inline */}
            {activeField === 'name' && canEdit ? (
              <input
                className="input"
                value={test.name}
                autoFocus
                onChange={(e) => update({ name: e.target.value })}
                onBlur={() => setActiveField(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setActiveField(null);
                  if (e.key === 'Escape') setActiveField(null);
                }}
                aria-label={t('tests.modal.nameLabel')}
                maxLength={300}
              />
            ) : (
              <h3
                className="detail-title"
                onClick={() => canEdit && setActiveField('name')}
                style={{ cursor: canEdit ? 'text' : undefined, padding: '4px 6px', margin: '-4px -6px', borderRadius: 6 }}
                onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title={canEdit ? t('issues.modal.clickToEdit') : undefined}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('name'); } }}
              >
                {test.name || <DetailEmpty>{t('tests.modal.noSteps')}</DetailEmpty>}
              </h3>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <ListChecks size={12} aria-hidden="true" /> {t('tests.modal.statusLabel')}
                </span>
                {activeField === 'status' && canEdit ? (
                  <select className="select" style={{ width: 160 }} value={test.status} autoFocus onChange={(e) => { update({ status: e.target.value as TestCaseStatus }); setActiveField(null); }} onBlur={() => setActiveField(null)}>
                    <option value="pending">{t('tests.status.pending')}</option>
                    <option value="pass">{t('tests.status.pass')}</option>
                    <option value="fail">{t('tests.status.fail')}</option>
                  </select>
                ) : (
                  <button type="button" onClick={() => canEdit && setActiveField('status')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: test.status === 'pass' ? 'var(--status-success-dim)' : test.status === 'fail' ? 'var(--status-danger-dim)' : 'var(--bg-inset)', border: test.status === 'pending' ? '1px solid var(--border-hairline)' : 'none', cursor: canEdit ? 'pointer' : 'default', fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: TEST_CASE_STATUS[test.status].tone === 'success' ? 'var(--status-success)' : TEST_CASE_STATUS[test.status].tone === 'danger' ? 'var(--status-danger)' : 'var(--text-muted)', flexShrink: 0 }} />
                    {TEST_CASE_STATUS[test.status].label}
                  </button>
                )}
              </div>

              {/* Linked Task */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <FileText size={12} aria-hidden="true" /> {t('tests.modal.linkedTaskLabel')}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
                  {linkedTask ? (
                    <span style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', overflowWrap: 'anywhere', maxWidth: '100%' }}>
                      <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{linkedTask.title}</span>
                      {canEdit && <button type="button" onClick={() => update({ taskId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px' }}>×</button>}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                  )}
                  {canEdit && (activeField === 'task' ? (
                    <SearchableSelect id="test-task-full" label="" value={test.taskId} options={state.tasks.map((x) => ({ value: x.id, label: x.title }))} onChange={(v) => { update({ taskId: v }); setActiveField(null); }} />
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveField('task')}>{linkedTask ? t('issues.modal.change') : t('issues.modal.add')}</button>
                  ))}
                </div>
              </div>

              {/* Linked Issue */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <FileText size={12} aria-hidden="true" /> {t('tests.modal.linkedIssueLabel')}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
                  {linkedIssue ? (
                    <span style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', overflowWrap: 'anywhere', maxWidth: '100%' }}>
                      <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{linkedIssue.title}</span>
                      {canEdit && <button type="button" onClick={() => update({ issueId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px' }}>×</button>}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                  )}
                  {canEdit && (activeField === 'issue' ? (
                    <SearchableSelect id="test-issue-full" label="" value={test.issueId} options={state.issues.map((x) => ({ value: x.id, label: x.title }))} onChange={(v) => { update({ issueId: v }); setActiveField(null); }} />
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveField('issue')}>{linkedIssue ? t('issues.modal.change') : t('issues.modal.add')}</button>
                  ))}
                </div>
              </div>

              {/* Steps card */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ListChecks size={12} aria-hidden="true" /> {t('tests.modal.stepsLabel')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('steps')}>
                      <ArrowsOutSimple size={14} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                {activeField === 'steps' && canEdit ? (
                  preview.steps ? (
                    <div className="md-preview">
                      {test.steps.trim() ? <MarkdownBlocks text={test.steps} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                    </div>
                  ) : (
                    <textarea
                      className="textarea"
                      value={test.steps}
                      autoFocus
                      rows={4}
                      placeholder={t('tests.newModal.stepsPlaceholder')}
                      onChange={(e) => update({ steps: e.target.value })}
                      onBlur={() => setActiveField(null)}
                      aria-label={t('tests.modal.stepsLabel')}
                      maxLength={10000}
                    />
                  )
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('steps')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('steps'); } }}
                    aria-label={canEdit ? 'Edit ' + t('tests.modal.stepsLabel') : undefined}
                    style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: test.steps.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}
                  >
                    {test.steps.trim() ? <MarkdownBlocks text={test.steps} /> : t('tests.modal.noSteps')}
                  </div>
                )}
                {activeField === 'steps' && canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: test.steps.length > 9000 ? 'var(--status-danger)' : test.steps.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {test.steps.length.toLocaleString()} / {(10000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Expected card */}
              <div style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} aria-hidden="true" /> {t('tests.modal.expectedLabel')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={t('tracker:issues.modal.fullscreenAriaDescription')} title={t('tracker:issues.modal.fullscreenAriaDescription')} onClick={() => setFullscreenField('expected')}>
                      <ArrowsOutSimple size={14} aria-hidden="true" />
                    </button>
                  </span>
                </div>
                {activeField === 'expected' && canEdit ? (
                  preview.expected ? (
                    <div className="md-preview">
                      {test.expected.trim() ? <MarkdownBlocks text={test.expected} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                    </div>
                  ) : (
                    <textarea
                      className="textarea"
                      value={test.expected}
                      autoFocus
                      rows={3}
                      placeholder={t('tests.newModal.expectedPlaceholder')}
                      onChange={(e) => update({ expected: e.target.value })}
                      onBlur={() => setActiveField(null)}
                      aria-label={t('tests.modal.expectedLabel')}
                      maxLength={5000}
                    />
                  )
                ) : (
                  <div
                    onClick={() => canEdit && setActiveField('expected')}
                    role={canEdit ? 'button' : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    onKeyDown={(e) => { if (canEdit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveField('expected'); } }}
                    aria-label={canEdit ? 'Edit ' + t('tests.modal.expectedLabel') : undefined}
                    style={{ cursor: canEdit ? 'text' : undefined, fontSize: 13, lineHeight: 1.6, color: test.expected.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}
                  >
                    {test.expected.trim() ? <MarkdownBlocks text={test.expected} /> : t('tests.modal.noExpected')}
                  </div>
                )}
                {activeField === 'expected' && canEdit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: test.expected.length > 4500 ? 'var(--status-danger)' : test.expected.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {test.expected.length.toLocaleString()} / {(5000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <h4 className="detail-subtitle">{t('tests.modal.activity')}</h4>
            <ActivityList projectId={projectId} entity="testCases" entityId={test.id} />
            <p className="field-helper">{t('tests.modal.updated', { time: formatRelative(test.updatedAt) })}</p>
          </>
        </div>
      </Modal>
      {fullscreenField === 'steps' && (
        <Modal open title={`${t('tests.modal.stepsLabel')} — Fullscreen`} onClose={() => setFullscreenField(null)} width="lg" className="modal-fullscreen">
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea className="textarea" style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }} value={test.steps} autoFocus={canEdit} readOnly={!canEdit} onChange={(e) => canEdit && update({ steps: e.target.value })} maxLength={10000} aria-label={t('tests.modal.stepsLabel')} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {test.steps.trim() ? <MarkdownBlocks text={test.steps} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: test.steps.length > 9000 ? 'var(--status-danger)' : test.steps.length > 8000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{test.steps.length.toLocaleString()} / {(10000).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}
      {fullscreenField === 'expected' && (
        <Modal open title={`${t('tests.modal.expectedLabel')} — Fullscreen`} onClose={() => setFullscreenField(null)} width="lg" className="modal-fullscreen">
          <div className="field">
            <div className="issue-fullscreen-split" style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.editTab')}</div>
                <textarea className="textarea" style={{ flex: 1, minHeight: 0, height: '100%', resize: 'none' }} value={test.expected} autoFocus={canEdit} readOnly={!canEdit} onChange={(e) => canEdit && update({ expected: e.target.value })} maxLength={5000} aria-label={t('tests.modal.expectedLabel')} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('tracker:issues.modal.previewTab')}</div>
                <div className="md-preview" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto' }}>
                  {test.expected.trim() ? <MarkdownBlocks text={test.expected} /> : <span className="md-preview-empty">{t('project:prd.nothingToPreview')}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="field-helper" style={{ margin: 0 }}>{canEdit ? t('tracker:issues.modal.fullscreenHelper') : t('tracker:issues.modal.fullscreenHelperReadOnly')}</p>
              <span style={{ fontSize: 11, color: test.expected.length > 4500 ? 'var(--status-danger)' : test.expected.length > 4000 ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{test.expected.length.toLocaleString()} / {(5000).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDeleteDialog
        open={confirmOpen}
        title={t('tests.modal.deleteConfirmTitle')}
        description={t('tests.modal.deleteConfirmBody')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
