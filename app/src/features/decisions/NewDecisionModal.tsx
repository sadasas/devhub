import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarBlank as CalendarIcon, FileText, ListChecks, Scales } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { formatDate, newId, nowIso } from '../../lib/utils';
import type { DecisionStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { CONCEPT_ICON } from '../../components/propertyIcons';
import { DatePicker } from '../../components/DatePicker';
import { MarkdownField } from '../../components/MarkdownField';
import { LIMITS } from '../../lib/limits';

interface NewDecisionModalProps {
  onClose: () => void;
}

const STATUS_OPTIONS: DecisionStatus[] = ['proposed', 'accepted', 'rejected', 'superseded'];

export function NewDecisionModal({ onClose }: NewDecisionModalProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const { dispatch, state } = useProject();
  usePresenceStatus('Creating decision');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<DecisionStatus | ''>('');
  const [date, setDate] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState('');
  const [decision, setDecision] = useState('');
  const [consequences, setConsequences] = useState('');
  const [milestoneId, setMilestoneId] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const datePillRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  // Fullscreen toggle via tombol header maupun Ctrl/Cmd+Shift+F.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'decision/add',
      decision: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        status: status === '' ? 'proposed' : status,
        date: date || ts.slice(0, 10),
        context: context.trim(),
        options: options.split('\n').map((o) => o.trim()).filter(Boolean).slice(0, 20),
        decision: decision.trim(),
        consequences: consequences.trim(),
        milestoneId: milestoneId ?? null,
      },
    });
    onClose();
  };

  const propLabels: Record<string, string> = {
    status: t('decisions.newModal.statusLabel'),
    date: t('decisions.newModal.dateLabel'),
    milestone: t('decisions.modal.milestoneLabel', { defaultValue: 'Milestone' }),
  };

  const datePillText = date ? formatDate(date) : t('decisions.newModal.dateLabel');

  return (
    <Modal
      open
      title={t('decisions.newModal.title')}
      onClose={onClose}
      width="lg"
      className={expanded ? 'modal-composer modal-composer--fullscreen' : 'modal-composer'}
      expandable
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      expandLabel={t('tracker:board.newTaskModal.expandView')}
      collapseLabel={t('tracker:board.newTaskModal.contractView')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('decisions.newModal.cancel')}
          </Button>
          <Button type="submit" form="new-decision-form" variant="primary" leftIcon={<Scales size={13} aria-hidden="true" />} disabled={!title.trim()}>
            {t('decisions.newModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-decision-form" className="composer-form" onSubmit={submit} noValidate>
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
            placeholder={t('decisions.newModal.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.DECISION_TITLE}
            aria-label={t('decisions.newModal.titleLabel')}
          />
          <MarkdownField
            label={t('decisions.newModal.contextLabel')}
            icon={FileText}
            value={context}
            onChange={setContext}
            placeholder={t('decisions.newModal.contextPlaceholder')}
            maxLength={LIMITS.DECISION_CONTEXT}
            rows={3}
            variant="bare"
            previewToggle
          />
          <MarkdownField
            label={t('decisions.newModal.optionsLabel')}
            icon={ListChecks}
            value={options}
            onChange={setOptions}
            placeholder={t('decisions.newModal.optionsPlaceholder')}
            maxLength={LIMITS.DECISION_OPTION}
            rows={3}
            variant="bare"
            previewToggle
          />
          <MarkdownField
            label={t('decisions.newModal.decisionLabel')}
            icon={Scales}
            value={decision}
            onChange={setDecision}
            placeholder={t('decisions.newModal.decisionPlaceholder')}
            maxLength={LIMITS.DECISION_TEXT}
            rows={3}
            variant="bare"
            previewToggle
          />
          <MarkdownField
            label={t('decisions.newModal.consequencesLabel')}
            icon={FileText}
            value={consequences}
            onChange={setConsequences}
            placeholder={t('decisions.newModal.consequencesPlaceholder')}
            maxLength={LIMITS.DECISION_CONSEQUENCES}
            rows={2}
            variant="bare"
            previewToggle
          />
        </div>
        <div className="composer-propbar" ref={barRef}>
          <span className="prop" data-prop="status" data-label={propLabels.status}>
            <span className="prop-ic" aria-hidden="true"><Scales size={14} /></span>
            <span className="sr-only">{propLabels.status}</span>
            <SearchableSelect
              id="new-decision-status"
              label=""
              ariaLabel={t('decisions.newModal.statusLabel')}
              searchable={false}
              value={status || null}
              allowEmpty={false}
              triggerEmptyLabel={t('decisions.newModal.statusLabel')}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`decisions.status.${s}`) }))}
              onChange={(v) => { if (v) setStatus(v as DecisionStatus); }}
            />
          </span>

          <button
            type="button"
            className="prop"
            data-prop="date"
            data-label={propLabels.date}
            data-pop-anchor="date"
            ref={datePillRef}
            onClick={() => setDateOpen((v) => !v)}
          >
            <span className="prop-ic" aria-hidden="true"><CalendarIcon size={14} /></span>
            <span className="prop-text">{datePillText}</span>
          </button>
          {dateOpen && (
            <DatePicker
              id="new-decision-date"
              mode="single"
              start={date ? date.slice(0, 10) : null}
              end={null}
              anchorEl={datePillRef.current}
              onApply={(s) => { setDate(s ?? ''); setDateOpen(false); }}
              onClose={() => setDateOpen(false)}
            />
          )}

          <span className="prop" data-prop="milestone" data-label={propLabels.milestone}>
            <span className="prop-ic" aria-hidden="true"><CONCEPT_ICON.milestone size={14} /></span>
            <span className="sr-only">{propLabels.milestone}</span>
            <SearchableSelect
              id="new-decision-milestone"
              label=""
              ariaLabel={t('decisions.modal.milestoneLabel', { defaultValue: 'Milestone' })}
              value={milestoneId}
              options={(state?.milestones ?? []).map((m) => ({ value: m.id, label: m.name }))}
              onChange={setMilestoneId}
              triggerEmptyLabel={t('decisions.modal.milestoneLabel', { defaultValue: 'Milestone' })}
            />
          </span>
        </div>
      </form>
    </Modal>
  );
}
