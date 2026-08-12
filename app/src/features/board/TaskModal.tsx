import { useEffect, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { TASK_PRIORITY, TASK_STATUS, TEST_CASE_STATUS } from '../../lib/labels';
import { formatRelative, isTaskCompletable, linkedTestCases, parseLabels } from '../../lib/utils';
import type { Task, TaskPriority, TaskStatus, TestCaseStatus } from '../../lib/types';import { useProject, wouldCreateCycle } from '../../state/project-context';
import type { UpdatePatch } from '../../state/project-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { InlineError } from '../../components/InlineError';

const STATUS_OPTIONS: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

interface TaskModalProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { state, dispatch, canEdit } = useProject();
  const [cycleWarn, setCycleWarn] = useState<string | null>(null);
  const [doneWarn, setDoneWarn] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setCycleWarn(null);
    setDoneWarn(null);
    setConfirmingDelete(false);
  }, [taskId]);

  const task = state?.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const update = (patch: UpdatePatch<Task>) =>
    dispatch({ type: 'task/update', id: task.id, patch });

  const changeStatus = (next: TaskStatus) => {
    if (next === 'done' && !isTaskCompletable(task, state!.testCases)) {
      const pending = state!.testCases.filter(
        (tc) => tc.taskId === task.id && tc.status !== 'pass',
      );
      setDoneWarn(
        `Cannot mark done: ${pending.length} test case${pending.length === 1 ? ' is' : 's are'} not passed yet.`,
      );
      return;
    }
    setDoneWarn(null);
    update({ status: next });
  };

  const otherTasks = state!.tasks.filter((t) => t.id !== task.id);
  const testCases = linkedTestCases(task.id, state!.testCases);
  const blockerNames = task.blockedBy
    .map((id) => state!.tasks.find((t) => t.id === id)?.title)
    .filter((t): t is string => t !== undefined);

  const toggleBlocker = (id: string) => {
    const next = task.blockedBy.includes(id)
      ? task.blockedBy.filter((x) => x !== id)
      : [...task.blockedBy, id];
    if (next.length > task.blockedBy.length && wouldCreateCycle(state!.tasks, task.id, next)) {
      setCycleWarn('This would create a dependency cycle.');
      return;
    }
    setCycleWarn(null);
    update({ blockedBy: next });
  };

  const remove = () => {
    dispatch({ type: 'task/remove', id: task.id });
    onClose();
  };

  return (
    <Modal
      open
      title="Edit task"
      onClose={onClose}
      width="md"
      footer={
        <>
          {confirmingDelete ? (
            <Button variant="danger" size="sm" onClick={remove}>
              Confirm delete
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete task
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmingDelete(false);
              onClose();
            }}
          >
            {confirmingDelete ? 'Cancel' : 'Close'}
          </Button>
        </>
      }
    >
      {confirmingDelete && (
        <p className="field-helper" style={{ padding: '0 16px 12px' }}>
          This permanently deletes the task. This cannot be undone.
        </p>
      )}
      <div className="form-stack">
        <Input
          label="Title"
          value={task.title}
          onChange={(e) => update({ title: e.target.value })}
        />

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="task-status">
              Status
            </label>
            <select
              id="task-status"
              className="select"
              value={task.status}
              onChange={(e) => changeStatus(e.target.value as TaskStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="task-priority">
              Priority
            </label>
            <select
              id="task-priority"
              className="select"
              value={task.priority}
              onChange={(e) => update({ priority: e.target.value as TaskPriority })}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY[p].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {doneWarn && <InlineError>{doneWarn}</InlineError>}

        <div className="field">
          <label className="field-label" htmlFor="task-milestone">
            Milestone
          </label>
          <select
            id="task-milestone"
            className="select"
            value={task.milestoneId ?? ''}
            onChange={(e) => update({ milestoneId: e.target.value || null })}
          >
            <option value="">None</option>
            {state!.milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <Input
            label="Estimate (hours)"
            type="number"
            min={0}
            value={task.estimate ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              update({ estimate: v === '' ? undefined : Math.max(0, Number(v)) });
            }}
          />
          <Input
            label="Actual (hours)"
            type="number"
            min={0}
            value={task.actualHours ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              update({ actualHours: v === '' ? undefined : Math.max(0, Number(v)) });
            }}
          />
        </div>

        <Input
          label="Labels"
          placeholder="comma, separated"
          value={task.labels.join(', ')}
          onChange={(e) => update({ labels: parseLabels(e.target.value) })}
        />

        <Textarea
          label="Description"
          rows={4}
          value={task.description}
          onChange={(e) => update({ description: e.target.value })}
        />

        <div className="field">
          <label className="field-label">
            Blocked by{blockerNames.length > 0 ? ` — ${blockerNames.join(', ')}` : ''}
          </label>
          <div className="blocker-list">
            {otherTasks.length === 0 && <p className="field-helper">No other tasks to depend on.</p>}
            {otherTasks.map((t) => (
              <label key={t.id} className="blocker-row">
                <input
                  type="checkbox"
                  checked={task.blockedBy.includes(t.id)}
                  onChange={() => toggleBlocker(t.id)}
                />
                <span className="blocker-title">{t.title}</span>
                <span className="blocker-state font-mono">{TASK_STATUS[t.status].label}</span>
              </label>
            ))}
          </div>
          {cycleWarn && <InlineError>{cycleWarn}</InlineError>}
        </div>

        <div className="field">
          <label className="field-label">
            Test cases{testCases.length > 0 ? ` — ${testCases.length}` : ''}
          </label>
          {testCases.length === 0 ? (
            <p className="field-helper">No test cases linked to this task yet.</p>
          ) : (
            <div className="test-list">
              {testCases.map((tc) => (
                <div key={tc.id} className="test-row" title={tc.steps || tc.name}>
                  <span className="test-title">{tc.name}</span>
                  {canEdit ? (
                    <select
                      className="select test-status-select"
                      aria-label={`Status of ${tc.name}`}
                      value={tc.status}
                      onChange={(e) =>
                        dispatch({
                          type: 'testCase/update',
                          id: tc.id,
                          patch: { status: e.target.value as TestCaseStatus },
                        })
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                    </select>
                  ) : (
                    <Badge tone={TEST_CASE_STATUS[tc.status].tone}>
                      {TEST_CASE_STATUS[tc.status].label}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="field-helper">Updated {formatRelative(task.updatedAt)}</p>
      </div>
    </Modal>
  );
}
