import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditPrdSectionModal } from './EditPrdSectionModal';
import type { Project } from '../../lib/types';

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ update: vi.fn() }),
}));
vi.mock('../../hooks/usePresenceStatus', () => ({
  usePresenceStatus: () => {},
}));

const project: Project = {
  id: 'p1',
  name: 'Demo',
  description: '',
  status: 'active',
  visibility: 'private',
  tabs: [],
  prd: { purpose: '', goals: '', features: '', scope: 'Engine + CLI', outOfScope: '' },
  teamId: 't1',
  teamName: 'T',
  role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('EditPrdSectionModal single-field', () => {
  it('judul hanya di header modal, tanpa kepala label redundan di field', () => {
    render(<EditPrdSectionModal open section="scope" onClose={() => {}} project={project} />);
    // Header modal membawa judul seksi.
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Kepala ikon+label MarkdownField disembunyikan (satu-satunya field).
    expect(document.querySelector('.md-bare-head')).toBeNull();
    // Field tetap punya nama aksesibel + nilai awal.
    const box = screen.getByRole('textbox', { name: 'Scope' }) as HTMLTextAreaElement;
    expect(box.value).toBe('Engine + CLI');
  });
});
