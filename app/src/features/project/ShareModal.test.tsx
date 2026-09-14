import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ShareModal } from './ShareModal';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  setStatus: vi.fn(),
  project: {
    id: 'p1',
    name: 'Demo',
    visibility: 'public',
    tabs: ['board', 'about'],
    contactUrl: 'https://owner.example/contact',
    liveDemoUrl: '',
  },
}));

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({
    projects: [mocks.project],
    update: mocks.update,
  }),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ setStatus: mocks.setStatus }),
}));

function renderModal() {
  return render(
    <MemoryRouter>
      <ShareModal projectId="p1" open onClose={() => {}} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ShareModal owner CTA', () => {
  // Catatan: test berjalan dalam locale en.
  const contactLabel = /contact link/i;
  const demoLabel = /demo link/i;
  const saveLabel = /save links/i;

  it('prefills contact/demo inputs from the project', async () => {
    renderModal();
    const contact = (await screen.findByLabelText(contactLabel)) as HTMLInputElement;
    const demo = (await screen.findByLabelText(demoLabel)) as HTMLInputElement;
    expect(contact.value).toBe('https://owner.example/contact');
    expect(demo.value).toBe('');
  });

  it('blocks save on invalid URL with an error', async () => {
    renderModal();
    const contact = (await screen.findByLabelText(contactLabel)) as HTMLInputElement;
    fireEvent.change(contact, { target: { value: 'javascript:alert(1)' } });

    expect(await screen.findByRole('alert')).toBeDefined();
    expect((screen.getByRole('button', { name: saveLabel }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('saves trimmed URLs and shows the saved indicator', async () => {
    mocks.update.mockResolvedValue({});
    renderModal();
    const demo = (await screen.findByLabelText(demoLabel)) as HTMLInputElement;
    fireEvent.change(demo, { target: { value: '  https://demo.example/app  ' } });

    const save = screen.getByRole('button', { name: saveLabel }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith('p1', {
        contactUrl: 'https://owner.example/contact',
        liveDemoUrl: 'https://demo.example/app',
      });
    });
    expect(await screen.findByText('Saved.')).toBeDefined();
  });

  it('allows clearing a link with empty string', async () => {
    mocks.update.mockResolvedValue({});
    renderModal();
    const contact = (await screen.findByLabelText(contactLabel)) as HTMLInputElement;
    fireEvent.change(contact, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: saveLabel }));
    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith('p1', { contactUrl: '', liveDemoUrl: '' });
    });
  });
});
