import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Trash, FileText, ListChecks, Clock, CheckCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelative } from '../../lib/utils';
import type { TestCase, TestCaseStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { PropRow } from '../../components/PropRow';
import { InlineError } from '../../components/InlineError';
import { DetailShell } from '../../components/DetailShell';
import { DetailEmpty } from '../../components/DetailList';
import { MarkdownField } from '../../components/MarkdownField';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';
import { LIMITS } from '../../lib/limits';

const STATUS_OPTIONS: TestCaseStatus[] = ['pending', 'pass', 'fail'];

interface TestModalProps {
  testId: string | null;
  onClose: () => void;
}

export function TestModal({ testId, onClose }: TestModalProps) {
  const { state, dispatch, canEdit, projectId, saving, lastSavedAt } = useProject();
  const [hotProp, setHotProp] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const { t } = useTranslation(['tracker', 'project']);

  useEffect(() => {
    setHotProp(null);
    setConfirmOpen(false);
  }, [testId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

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
  const nameEmpty = test.name.trim() === '';

  return (
    <DetailShell
      title={t('tests.modal.viewTitle')}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('tests.modal.delete')}
            </Button>
            {(saving || lastSavedAt) && !nameEmpty && (
              <span className="save-state" role="status">
                {saving ? (
                  t('board.taskModal.autosaveSaving')
                ) : (
                  <>
                    <CheckCircle size={13} weight="bold" aria-hidden="true" />
                    {t('board.taskModal.autosaveSaved')}
                  </>
                )}
              </span>
            )}
          </>
        ) : undefined
      }
      sidebarHead={t('board.taskModal.propertiesLabel')}
      sidebar={<>
        <PropRow
          propKey="status"
          label={t('tests.modal.statusLabel')}
          hot={hotProp === 'status'}
          setHot={setHotProp}
          canEdit={canEdit}
          view={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 999, background: test.status === 'pass' ? 'var(--status-success-dim)' : test.status === 'fail' ? 'var(--status-danger-dim)' : 'var(--bg-inset)', border: test.status === 'pending' ? '1px solid var(--border-hairline)' : 'none', fontSize: 12 }}>
              {t(`tests.status.${test.status}`)}
            </span>
          )}
          control={(
            <SearchableSelect defaultOpen searchable={false} id="test-status" label="" ariaLabel={t('tests.modal.statusLabel')} value={test.status} allowEmpty={false} options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`tests.status.${s}`) }))} onChange={(v) => { if (v) { update({ status: v as TestCaseStatus }); setHotProp(null); } }} />
          )}
        />
        <PropRow
          propKey="task"
          label={t('tests.modal.linkedTaskLabel')}
          hot={hotProp === 'task'}
          setHot={setHotProp}
          canEdit={canEdit}
          view={linkedTask ? (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{linkedTask.title}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
          )}
          control={(
            <SearchableSelect defaultOpen id="test-task" label="" ariaLabel={t('tests.modal.linkedTaskLabel')} value={test.taskId} options={state.tasks.map((x) => ({ value: x.id, label: x.title }))} onChange={(v) => { update({ taskId: v }); setHotProp(null); }} triggerEmptyLabel={t('tests.modal.linkedTaskLabel')} />
          )}
        />
        <PropRow
          propKey="issue"
          label={t('tests.modal.linkedIssueLabel')}
          hot={hotProp === 'issue'}
          setHot={setHotProp}
          canEdit={canEdit}
          view={linkedIssue ? (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{linkedIssue.title}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
          )}
          control={(
            <SearchableSelect defaultOpen id="test-issue" label="" ariaLabel={t('tests.modal.linkedIssueLabel')} value={test.issueId} options={state.issues.map((x) => ({ value: x.id, label: x.title }))} onChange={(v) => { update({ issueId: v }); setHotProp(null); }} triggerEmptyLabel={t('tests.modal.linkedIssueLabel')} />
          )}
        />
      </>}
      after={(
        <ConfirmDeleteDialog
          open={confirmOpen}
          title={t('tests.modal.deleteConfirmTitle')}
          description={t('tests.modal.deleteConfirmBody')}
          onClose={() => setConfirmOpen(false)}
          onConfirm={remove}
        />
      )}
    >
      {canEdit ? (
        <textarea
          ref={titleRef}
          className="composer-title"
          rows={1}
          value={test.name}
          autoFocus
          maxLength={LIMITS.TESTCASE_NAME}
          onChange={(e) => update({ name: e.target.value })}
          aria-label={t('tests.modal.nameLabel')}
          aria-invalid={nameEmpty}
          placeholder={t('tests.newModal.namePlaceholder')}
        />
      ) : (
        <h3 className="detail-title">
          {test.name || <DetailEmpty>{t('tests.modal.noSteps')}</DetailEmpty>}
        </h3>
      )}
      {nameEmpty && <InlineError>{t('tracker:issues.modal.titleRequired')}</InlineError>}
      <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span style={{ width: 110, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Clock size={12} aria-hidden="true" /> {t('tracker:issues.modal.createdTimeLabel')}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDate(test.createdAt)} {new Date(test.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {canEdit ? (
        <MarkdownField
          label={t('tests.modal.stepsLabel')}
          icon={ListChecks}
          value={test.steps}
          onChange={(v) => update({ steps: v })}
          placeholder={t('tests.newModal.stepsPlaceholder')}
          maxLength={LIMITS.TESTCASE_STEPS}
          rows={4}
          variant="bare"
          previewToggle
        />
      ) : (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ListChecks size={12} aria-hidden="true" /> {t('tests.modal.stepsLabel')}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: test.steps.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {test.steps.trim() ? <MarkdownBlocks text={test.steps} /> : t('tests.modal.noSteps')}
          </div>
        </div>
      )}
      {canEdit ? (
        <MarkdownField
          label={t('tests.modal.expectedLabel')}
          icon={FileText}
          value={test.expected}
          onChange={(v) => update({ expected: v })}
          placeholder={t('tests.newModal.expectedPlaceholder')}
          maxLength={LIMITS.TESTCASE_EXPECTED}
          rows={3}
          variant="bare"
          previewToggle
        />
      ) : (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} aria-hidden="true" /> {t('tests.modal.expectedLabel')}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: test.expected.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {test.expected.trim() ? <MarkdownBlocks text={test.expected} /> : t('tests.modal.noExpected')}
          </div>
        </div>
      )}
      <h4 className="detail-subtitle">{t('tests.modal.activity')}</h4>
      <ActivityList projectId={projectId} entity="testCases" entityId={test.id} />
      <p className="field-helper">{t('tests.modal.updated', { time: formatRelative(test.updatedAt) })}</p>
    </DetailShell>
  );
}
