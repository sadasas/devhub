import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewKeyModal } from './NewKeyModal';
import type { McpKeyCreated } from '../../lib/types';

const apiMock = vi.hoisted(() => {
  class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { listKeys: vi.fn(), createKey: vi.fn(), revokeKey: vi.fn(), ApiError };
});

vi.mock('../../lib/api', () => ({
  api: apiMock,
  ApiError: apiMock.ApiError,
}));

const createdKey: McpKeyCreated = {
  id: 'k-new',
  name: 'ci-runner',
  prefix: 'devhub_N',
  key: 'devhub_ShownOnlyOnce',
  createdAt: '2026-08-19T10:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  revealable: true,
};

function renderModal(activeCount = 0, onCreated = vi.fn()) {
  return render(<NewKeyModal open onClose={vi.fn()} onCreated={onCreated} activeCount={activeCount} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewKeyModal', () => {
  it('creates a key and reveals it once with an env-var snippet', async () => {
    apiMock.createKey.mockResolvedValue(createdKey);
    const onCreated = vi.fn();
    renderModal(0, onCreated);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'ci-runner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    expect(await screen.findByText(createdKey.key)).not.toBeNull();
    expect(screen.getByText(/shown only once/i)).not.toBeNull();
    expect(screen.getByText(`DEVHUB_MCP_KEY="${createdKey.key}"`)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCreated).toHaveBeenCalledWith(createdKey);
  });

  it('reports the created key even when closed via the header X button', async () => {
    apiMock.createKey.mockResolvedValue(createdKey);
    const onCreated = vi.fn();
    renderModal(0, onCreated);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'ci-runner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    await screen.findByText(createdKey.key);

    // Tutup lewat X header (bukan Done) — key tetap harus masuk list
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCreated).toHaveBeenCalledWith(createdKey);
  });

  it('copies the env-var snippet to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    apiMock.createKey.mockResolvedValue(createdKey);
    renderModal();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'ci-runner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    await screen.findByText(createdKey.key);

    fireEvent.click(screen.getByRole('button', { name: 'Copy as DEVHUB_MCP_KEY environment variable' }));
    expect(writeText).toHaveBeenCalledWith(`DEVHUB_MCP_KEY="${createdKey.key}"`);
  });

  it('disables the create button until a name is provided', () => {
    renderModal();

    const createBtn = screen.getByRole('button', { name: 'Create key' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'ci-runner' } });
    expect((screen.getByRole('button', { name: 'Create key' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('warns when the user is near the active key cap', () => {
    renderModal(9);

    expect(screen.getByText(/maximum is 10/i)).not.toBeNull();
  });

it('shows the server error when creation fails', async () => {
    apiMock.createKey.mockRejectedValue(
      new apiMock.ApiError(400, 'VALIDATION_ERROR', 'Maximum of 10 active API keys reached; revoke one first'),
    );
    renderModal();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'ci-runner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    expect(await screen.findByText(/maximum of 10 active API keys/i)).not.toBeNull();
  });
});