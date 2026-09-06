import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Flag, ListChecks } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { TestCaseStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownField } from '../../components/MarkdownField';
import { LIMITS } from '../../lib/limits';
import { CONCEPT_ICON } from '../../components/propertyIcons';

const STATUS_OPTIONS: TestCaseStatus[] = ['pending', 'pass', 'fail'];

interface NewTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTestModal({ open, onClose }: NewTestModalProps) {
  const { state, dispatch } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('tests.newModal.presenceCreating'), open);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TestCaseStatus | ''>('');
  const [taskId, setTaskId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setStatus('');
      setTaskId('');
      setIssueId('');
      setSteps('');
      setExpected('');
    }
  }, [open]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

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
        status: status === '' ? 'pending' : status,
        taskId: taskId || null,
        issueId: issueId || null,
        steps: steps.trim(),
        expected: expected.trim(),
      },
    });
    setName('');
    setStatus('');
    setTaskId('');
    setIssueId('');
    setSteps('');
    setExpected('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('tests.newModal.title')}
      onClose={onClose}
      width="lg"
      className="modal-composer"
      footer={
        <Button type="submit" form="new-test-form" leftIcon={<ListChecks size={13} aria-hidden="true" />} disabled={!name.trim()}>
          {t('tests.newModal.submit')}
        </Button>
      }
    >
      <form id="new-test-form" className="composer-form" onSubmit={onSubmit} noValidate>
        <div
          className="composer-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            barRef.current?.classList.toggle('is-stuck', (e.target as HTMLDivElement).scrollTop > 4);
          }}
        >
          <textarea
            ref={titleRef}
            className="composer-title"
            rows={1}
            required
            autoFocus
            placeholder={t('tests.newModal.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.TESTCASE_NAME}
            aria-label={t('tests.newModal.nameLabel')}
          />
          <MarkdownField
            label={t('tests.newModal.stepsLabel')}
            icon={ListChecks}
            value={steps}
            onChange={setSteps}
            placeholder={t('tests.newModal.stepsPlaceholder')}
            maxLength={LIMITS.TESTCASE_STEPS}
            rows={4}
            variant="bare"
            previewToggle
          />
          <MarkdownField
            label={t('tests.newModal.expectedLabel')}
            icon={FileText}
            value={expected}
            onChange={setExpected}
            placeholder={t('tests.newModal.expectedPlaceholder')}
            maxLength={LIMITS.TESTCASE_EXPECTED}
            rows={3}
            variant="bare"
            previewToggle
          />
        </div>
        <div className="composer-propbar" ref={barRef}>
          <span className="prop" data-prop="status" data-label={t('tests.newModal.statusLabel')}>
            <span className="prop-ic" aria-hidden="true"><Flag size={14} /></span>
            <span className="sr-only">{t('tests.newModal.statusLabel')}</span>
            <SearchableSelect
              id="new-test-status"
              label=""
              ariaLabel={t('tests.newModal.statusLabel')}
              value={status || null}
              allowEmpty={false}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`tests.status.${s}`) }))}
              onChange={(v) => { if (v) setStatus(v as TestCaseStatus); }}
              triggerEmptyLabel={t('tests.newModal.statusLabel')}
            />
          </span>
          <span className="prop" data-prop="task" data-label={t('tests.newModal.linkedTaskLabel')}>
            <span className="prop-ic" aria-hidden="true"><CONCEPT_ICON.task size={14} /></span>
            <span className="sr-only">{t('tests.newModal.linkedTaskLabel')}</span>
            <SearchableSelect
              id="new-test-task"
              label=""
              ariaLabel={t('tests.newModal.linkedTaskLabel')}
              value={taskId || null}
              options={state.tasks.map((x) => ({ value: x.id, label: x.title }))}
              onChange={(v) => setTaskId(v ?? '')}
              triggerEmptyLabel={t('tests.newModal.linkedTaskLabel')}
            />
          </span>
          <span className="prop" data-prop="issue" data-label={t('tests.newModal.linkedIssueLabel')}>
            <span className="prop-ic" aria-hidden="true"><CONCEPT_ICON.issue size={14} /></span>
            <span className="sr-only">{t('tests.newModal.linkedIssueLabel')}</span>
            <SearchableSelect
              id="new-test-issue"
              label=""
              ariaLabel={t('tests.newModal.linkedIssueLabel')}
              value={issueId || null}
              options={state.issues.map((x) => ({ value: x.id, label: x.title }))}
              onChange={(v) => setIssueId(v ?? '')}
              triggerEmptyLabel={t('tests.newModal.linkedIssueLabel')}
            />
          </span>
        </div>
      </form>
    </Modal>
  );
}
