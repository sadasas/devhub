import { Badge } from './Badge';
import { TASK_STATUS } from '../lib/labels';
import { TaskStatusIcon } from '../lib/task-icons';
import type { TaskStatus } from '../lib/types';

/**
 * Badge status task yang seragam: ikon + label + tone terpusat.
 * Satu-satunya cara me-render status task sebagai badge — jangan hardcode
 * salinan span/`Badge` di call-site (audit 2026-10: 8 salinan manual,
 * satu kelewat tanpa ikon).
 * `size` mengikuti teks sebelahnya: 11 kartu, 12 properti/badge,
 * 14 kalender (aturan token: glyph mengikuti teks).
 */
export function TaskStatusBadge({ status, size = 12 }: { status: TaskStatus; size?: number }) {
  return (
    <Badge tone={TASK_STATUS[status].tone}>
      <TaskStatusIcon status={status} size={size} />
      {TASK_STATUS[status].label}
    </Badge>
  );
}
