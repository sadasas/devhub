import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlank as CalendarIcon, Clock, DotsThree, FileText, Flag, LinkSimple, Plus, Tag, User } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, isDecimalKey, newId, nowIso, parseLabels, sanitizeDecimalInput } from '../../lib/utils';
import { TASK_PRIORITY, TASK_PRIORITY_ORDER, hashLabelColor } from '../../lib/labels';
import { startAfterDue } from '../../lib/start-dates';
import type { Attachment, TaskPriority, TaskStatus, TeamMember } from '../../lib/types';
import { LabelPickerBody } from './LabelPickerBody';
import { useProject } from '../../state/project-context';
import { useOptionalAuth } from '../../state/auth-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { api } from '../../lib/api';
import { Button } from '../../components/Button';
import { AttachmentSection } from '../../components/AttachmentSection';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Avatar } from '../../components/Avatar';
import { SearchableSelect } from '../../components/SearchableSelect';
import { DatePicker } from '../../components/DatePicker';
import { MarkdownField } from '../../components/MarkdownField';
import { FE_LIMITS, LIMITS } from '../../lib/limits';

type PropKey = 'priority' | 'dates' | 'assignee' | 'milestone' | 'estimate' | 'labels' | 'blockedBy';

interface NewTaskModalProps {
  open: boolean;
  status: TaskStatus | null;
  milestoneId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  onClose: () => void;
}

export function NewTaskModal({ open, status, milestoneId, dueDate, startDate, onClose }: NewTaskModalProps) {
  const { state, dispatch, teamId, projectId, canEdit } = useProject();
  const { user } = useOptionalAuth();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('board.newTaskModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [estimate, setEstimate] = useState('');
  const [labels, setLabels] = useState('');
  const [description, setDescription] = useState('');
  const [milestone, setMilestone] = useState<string | null>(milestoneId ?? null);
  const [dueDateInput, setDueDateInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [datesOpen, setDatesOpen] = useState(false);
  const datesPillRef = useRef<HTMLButtonElement>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [popup, setPopup] = useState<{ key: PropKey; anchor: { top: number; bottom: number; left: number } } | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  /** Lampiran staged: ID draft dibuat saat modal dibuka agar storageKey stabil. */
  const [draftId, setDraftId] = useState(() => newId());
  const [draft, setDraft] = useState<Attachment[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [storageLimitOpen, setStorageLimitOpen] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setExpanded(false);
      setDraftId(newId());
      setDraft([]);
      setUploadBusy(false);
      setStorageLimitOpen(false);
      savedRef.current = false;
      setMilestone(milestoneId ?? null);
      // Prefill dari konteks papan (mis. tanggal yang diklik di calendar).
      setDueDateInput(dueDate?.slice(0, 10) ?? '');
      setStartDateInput(startDate?.slice(0, 10) ?? '');
      setAssignee(null);
      setBlockedBy([]);
    }
  }, [open, milestoneId, dueDate, startDate]);

  useEffect(() => {
    if (open && teamId) {
      api.listMembers(teamId).then(setMembers).catch(() => setMembers([]));
    } else if (!open) {
      setMembers([]);
    }
  }, [open, teamId]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  useEffect(() => {
    if (!popup) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (popRef.current?.contains(t as Node) || t?.closest?.('[data-pop-anchor]')) return;
      setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popup]);

  // Ukur tinggi asli panel setelah render (sebelum paint) lalu tempelkan ke pill.
  const measurePopup = useCallback(() => {
    if (!popup) return;
    const h = popRef.current?.offsetHeight ?? 0;
    const w = 240;
    const below = popup.anchor.bottom + 6;
    const fitsBelow = window.innerHeight - below >= h + 8;
    const next = {
      top: fitsBelow ? below : Math.max(8, popup.anchor.top - h - 6),
      left: Math.max(8, Math.min(popup.anchor.left, window.innerWidth - w - 8)),
    };
    setPopupPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [popup]);

  useLayoutEffect(() => {
    measurePopup();
  }, [measurePopup]);

  useEffect(() => {
    if (!popup) return;
    window.addEventListener('resize', measurePopup);
    return () => window.removeEventListener('resize', measurePopup);
  }, [popup, measurePopup]);

  // Fokus ke panel untuk popup non-teks; input teks tanpa autoFocus
  // (coarse-pointer: hindari keyboard virtual) — fokus awal diatur useFocusTrap di Modal.
  useEffect(() => {
    if (popup && popup.key !== 'estimate' && popup.key !== 'labels') {
      popRef.current?.focus({ preventScroll: true });
    }
  }, [popup]);

  // Fullscreen toggle via tombol header maupun Ctrl/Cmd+Shift+F.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setExpanded((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function openPopup(key: PropKey, anchor: HTMLElement) {
    const r = anchor.getBoundingClientRect();
    setPopup({ key, anchor: { top: r.top, bottom: r.bottom, left: r.left } });
  }

  const assigneeMember = members.find((m) => m.id === assignee) ?? null;

  const priorityBg =
    priority === '' || TASK_PRIORITY[priority].tone === 'neutral'
      ? undefined
      : `var(--status-${TASK_PRIORITY[priority].tone}-dim)`;

  const statusDot =
    status === 'done'
      ? 'var(--status-success)'
      : status === 'review'
        ? 'var(--status-warn)'
        : status === 'inProgress'
          ? 'var(--status-info)'
          : 'var(--text-muted)';

  const propLabels: Record<string, string> = {
    status: t('board.taskModal.statusLabel'),
    priority: t('board.newTaskModal.priorityLabel'),
    startDate: t('board.taskModal.startDateLabel'),
    dueDate: t('board.taskModal.dueDateLabel'),
    assignee: t('board.taskModal.assigneeLabel'),
    milestone: t('board.newTaskModal.milestoneLabel'),
    estimate: t('board.newTaskModal.estimateLabel'),
    labels: t('board.newTaskModal.labelsLabel'),
    blockedBy: t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' }),
  };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (startAfterDue(startDateInput, dueDateInput)) return;
    const taskStatus = status ?? 'todo';
    const parsedEstimate = Number(estimate);
    const parsedLabels = parseLabels(labels);
    const ts = nowIso();
    // Buat-cepat definisi untuk nama label baru (kunci = nama, warna hash).
    const seen = new Set((state?.labelDefs ?? []).map((d) => d.name.trim().toLowerCase()));
    for (const raw of parsedLabels) {
      const name = raw.trim().slice(0, 50);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      dispatch({
        type: 'labelDef/add',
        labelDef: { id: newId(), createdAt: ts, updatedAt: ts, name, color: hashLabelColor(key), description: '' },
      });
    }
    dispatch({
      type: 'task/add',
      task: {
        id: draftId,
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        status: taskStatus,
        priority: priority === '' ? 'medium' : priority,
        estimate: estimate !== '' && estimate !== '.' && !Number.isNaN(parsedEstimate) ? Math.min(FE_LIMITS.ESTIMATE_MAX, Math.max(0, parsedEstimate)) : undefined,
        labels: parsedLabels,
        blockedBy: [...new Set(blockedBy)],
        milestoneId: milestone,
        dueDate: dueDateInput === '' ? null : dueDateInput,
        startDate: startDateInput === '' ? null : startDateInput,
        assigneeId: assignee,
        description: description.trim(),
        ...(draft.length > 0 ? { attachments: draft } : {}),
      },
    });
    savedRef.current = true;
    setTitle('');
    setPriority('');
    setEstimate('');
    setLabels('');
    setDescription('');
    setMilestone(null);
    setDueDateInput('');
    setStartDateInput('');
    setAssignee(null);
    setBlockedBy([]);
    setDraft([]);
    onClose();
  }

  /** Tutup tanpa save → bersihkan file staged yang yatim (best-effort). */
  function handleClose() {
    if (!savedRef.current && projectId) {
      for (const a of draft) {
        if (a.provider === 'devhub' && a.storageKey) {
          void api.attachmentAbandon(projectId, a.storageKey).catch(() => {});
        }
      }
    }
    savedRef.current = false;
    onClose();
  }

  const priorityControl = (
    <SearchableSelect
      id="new-task-priority"
      ariaLabel={t('board.newTaskModal.priorityLabel')}
      value={priority || null}
      options={TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY[p].label }))}
      emptyLabel={t('board.newTaskModal.priorityLabel')}
      triggerEmptyLabel={t('board.newTaskModal.priorityLabel')}
      searchable={false}
      onChange={(v) => setPriority((v as TaskPriority) ?? '')}
    />
  );

  const datesPillText =
    startDateInput && dueDateInput
      ? `${formatDate(startDateInput)} – ${formatDate(dueDateInput)}`
      : startDateInput || dueDateInput
        ? formatDate(startDateInput || dueDateInput)
        : t('board.taskModal.dateLabel');

  const assigneeControl = (
    <SearchableSelect
      id="new-task-assignee"
      label=""
      ariaLabel={t('board.taskModal.assigneeLabel')}
      value={assignee}
      options={[
        ...(user?.id && assignee !== user.id
          ? (() => {
            const me = members.find((m) => m.id === user.id);
            const n = me?.displayName || me?.email || t('board.taskModal.assignToMe', { defaultValue: 'Assign to me' });
            return [{ value: user.id, label: t('board.taskModal.assignToMe', { defaultValue: 'Assign to me' }), icon: <Avatar src={me?.avatarUrl ?? null} name={n} email={me?.email} id={user.id} size={20} alt="" /> }];
          })()
          : []),
        ...members.map((m) => { const n = m.displayName || m.email; return { value: m.id, label: n, icon: <Avatar src={m.avatarUrl ?? null} name={n} email={m.email} id={m.id} size={20} alt="" /> }; }),
      ]}
      onChange={setAssignee}
      triggerEmptyLabel={t('board.taskModal.assigneeLabel')}
    />
  );

  const milestoneControl =
    state && state.milestones.length > 0 ? (
      <SearchableSelect
        id="new-task-milestone"
        label=""
        ariaLabel={t('board.newTaskModal.milestoneLabel')}
        value={milestone}
        options={state.milestones.map((m) => ({ value: m.id, label: m.name }))}
        onChange={setMilestone}
        triggerEmptyLabel={t('board.newTaskModal.milestoneLabel')}
      />
    ) : null;

  const estimateControl = (
    <input
      className="input"
      type="number"
      min={0}
      max={FE_LIMITS.ESTIMATE_MAX}
      step="any"
      placeholder={t('board.newTaskModal.estimateLabel')}
      value={estimate}
      onChange={(e) => setEstimate(sanitizeDecimalInput(e.target.value))}
      inputMode="decimal"
      aria-label={t('board.newTaskModal.estimateLabel')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') setPopup(null);
        else if (!isDecimalKey(e.key)) e.preventDefault();
      }}
    />
  );

  const labelsControl = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
      <LabelPickerBody draft={labels} onChange={setLabels} />
    </div>
  );

  const blockedByControl = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
      {blockedBy.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {blockedBy.map((id) => {
            const bt = state?.tasks.find((tt) => tt.id === id);
            return (
              <span key={id} style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-hairline)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <LinkSimple size={10} aria-hidden="true" /> {bt?.title ?? id.slice(0, 6)}
                <button type="button" onClick={() => setBlockedBy((prev) => prev.filter((x) => x !== id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: '0 2px', lineHeight: 1, minWidth: 24, minHeight: 24 }} aria-label={`Remove blocker ${bt?.title ?? id}`}>×</button>
              </span>
            );
          })}
        </div>
      )}
      <SearchableSelect
        id="new-task-blockedBy"
        label=""
        ariaLabel={t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })}
        value={null}
        options={(state?.tasks ?? []).filter((ot) => !blockedBy.includes(ot.id) && !ot.parentTaskId).map((ot) => ({ value: ot.id, label: `${ot.title} · ${ot.status}` }))}
        onChange={(v) => { if (v) setBlockedBy((prev) => [...new Set([...prev, v])]); }}
        triggerEmptyLabel={t('board.taskModal.blockedByLabel', { defaultValue: 'Blocked by' })}
      />
    </div>
  );

  const propControls: Record<PropKey, ReactNode> = {
    priority: priorityControl,
    dates: null,
    assignee: assigneeControl,
    milestone: milestoneControl,
    estimate: estimateControl,
    labels: labelsControl,
    blockedBy: blockedByControl,
  };

  return (
    <>
    <Modal
      open={open}
      title={t('board.newTaskModal.title')}
      onClose={handleClose}
      width="lg"
      className={expanded ? 'modal-composer modal-composer--fullscreen' : 'modal-composer'}
      expandable
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      expandLabel={t('board.newTaskModal.expandView')}
      collapseLabel={t('board.newTaskModal.contractView')}
      footer={
        <Button type="submit" size="md" form="new-task-form" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} disabled={!title.trim() || !!startAfterDue(startDateInput, dueDateInput) || uploadBusy}>
          {t('board.newTaskModal.submit')}
        </Button>
      }
    >
      <form id="new-task-form" className="composer-form" onSubmit={onSubmit} noValidate>
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
            placeholder={t('board.newTaskModal.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.TASK_TITLE}
            aria-label={t('board.newTaskModal.titleLabel')}
          />
          <MarkdownField
            label={t('board.newTaskModal.descriptionLabel')}
            icon={FileText}
            value={description}
            onChange={setDescription}
            placeholder={t('board.newTaskModal.descriptionPlaceholder')}
            maxLength={LIMITS.TASK_DESCRIPTION}
            rows={4}
            variant="bare"
            previewToggle
          />
          {canEdit && projectId && (
            <AttachmentSection
              mode="staged"
              projectId={projectId}
              entity="tasks"
              entityId={draftId}
              attachments={draft}
              canEdit={canEdit}
              onChanged={setDraft}
              onQuotaExceeded={() => setStorageLimitOpen(true)}
              onBusyChange={setUploadBusy}
            />
          )}
        </div>
        <div className="composer-propbar" ref={barRef}>
          <span
            className="prop prop-static"
            data-prop="status"
            data-label={propLabels.status}
            style={{
              background:
                status === 'done'
                  ? 'var(--status-success-dim)'
                  : status === 'review'
                    ? 'var(--status-warn-dim)'
                    : status === 'inProgress'
                      ? 'var(--status-info-dim)'
                      : 'var(--bg-inset)',
              border: 'none',
            }}
          >
            <span className="dot" style={{ background: statusDot }} aria-hidden="true" />
            {status ? t(`board.column.${status}`) : t('board.column.todo')}
          </span>

          <span
            className="prop"
            data-prop="priority"
            data-label={propLabels.priority}
            style={priorityBg ? { background: priorityBg, border: 'none' } : undefined}
          >
            <span className="prop-ic" aria-hidden="true"><DotsThree size={14} /></span>
            <span className="sr-only">{propLabels.priority}</span>
            {popup?.key !== 'priority' && priorityControl}
          </span>

          <button
            type="button"
            className="prop"
            data-prop="dates"
            data-label={propLabels.startDate}
            data-pop-anchor="dates"
            ref={datesPillRef}
            onClick={() => { setPopup(null); setDatesOpen((v) => !v); }}
          >
            <span className="prop-ic" aria-hidden="true"><CalendarIcon size={14} /></span>
            <span className="prop-text">{datesPillText}</span>
          </button>
          {datesOpen && (
            <DatePicker
              id="new-task-dates"
              mode="range"
              start={startDateInput ? startDateInput.slice(0, 10) : null}
              end={dueDateInput ? dueDateInput.slice(0, 10) : null}
              anchorEl={datesPillRef.current}
              onApply={(s, e) => { setStartDateInput(s ?? ''); setDueDateInput(e ?? ''); setDatesOpen(false); }}
              onClose={() => setDatesOpen(false)}
            />
          )}

          <span className="prop" data-prop="assignee" data-label={propLabels.assignee}>
            {assigneeMember ? (
              <Avatar
                src={assigneeMember.avatarUrl ?? null}
                name={assigneeMember.displayName || assigneeMember.email}
                email={assigneeMember.email}
                id={assigneeMember.id}
                size={18}
                alt=""
              />
            ) : (
              <span className="prop-ic" aria-hidden="true"><User size={14} /></span>
            )}
            <span className="sr-only">{propLabels.assignee}</span>
            {popup?.key !== 'assignee' && assigneeControl}
          </span>

          {state && state.milestones.length > 0 && (
          <span className="prop" data-prop="milestone" data-label={propLabels.milestone}>
            <span className="prop-ic" aria-hidden="true"><Flag size={14} /></span>
            <span className="sr-only">{propLabels.milestone}</span>
            {popup?.key !== 'milestone' && milestoneControl}
            </span>
          )}

          <button
            type="button"
            className="prop"
            data-prop="estimate"
            data-label={propLabels.estimate}
            data-pop-anchor="estimate"
            onClick={(e) => (popup?.key === 'estimate' ? setPopup(null) : openPopup('estimate', e.currentTarget))}
          >
            <span className="prop-ic" aria-hidden="true"><Clock size={14} /></span>
            <span className="prop-text">{estimate === '' ? propLabels.estimate : `${estimate}h`}</span>
          </button>

          <button
            type="button"
            className="prop"
            data-prop="labels"
            data-label={propLabels.labels}
            data-pop-anchor="labels"
            onClick={(e) => (popup?.key === 'labels' ? setPopup(null) : openPopup('labels', e.currentTarget))}
          >
            <span className="prop-ic" aria-hidden="true"><Tag size={14} /></span>
            <span className="prop-text">{labels === '' ? propLabels.labels : labels}</span>
          </button>

          <button
            type="button"
            className="prop"
            data-prop="blockedBy"
            data-label={propLabels.blockedBy}
            data-pop-anchor="blockedBy"
            onClick={(e) => (popup?.key === 'blockedBy' ? setPopup(null) : openPopup('blockedBy', e.currentTarget))}
          >
            <span className="prop-ic" aria-hidden="true"><LinkSimple size={14} /></span>
            <span className="prop-text">{blockedBy.length === 0 ? propLabels.blockedBy : `${blockedBy.length} blocked`}</span>
          </button>
        </div>
        {startAfterDue(startDateInput, dueDateInput) && <div className="composer-error"><InlineError>{t('board.newTaskModal.dateWarn')}</InlineError></div>}
      </form>
      {popup && createPortal(
        <div
          ref={popRef}
          className="prop-menu prop-pop"
          role="dialog"
          tabIndex={-1}
          aria-label={propLabels[popup.key]}
          style={popupPos ? { top: popupPos.top, left: popupPos.left } : { visibility: 'hidden' }}
        >
          <div className="prop-pop-label">{propLabels[popup.key]}</div>
          {propControls[popup.key]}
        </div>,
        document.body,
      )}
    </Modal>
      {teamId && (
        <PlanLimitModal
          open={storageLimitOpen}
          resource="storage"
          teamId={teamId}
          onClose={() => setStorageLimitOpen(false)}
        />
      )}
    </>
  );
}
