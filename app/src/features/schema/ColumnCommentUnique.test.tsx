import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NewTableModal } from './NewTableModal';
import { TableModal } from './TableModal';
import { FE_LIMITS } from '../../lib/limits';
import type { State, Table } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function baseState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

function tableWith(over: Partial<Table> = {}): Table {
  return {
    id: 'tb1',
    name: 'users',
    comment: '',
    columns: [
      { id: 'c1', name: 'email', type: 'text', nullable: true, primaryKey: false, default: null, comment: '' },
      { id: 'c2', name: 'name', type: 'text', nullable: true, primaryKey: false, default: null, comment: '' },
    ],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderNew(dispatch: ReturnType<typeof vi.fn>) {
  useProjectMock.mockReturnValue({
    state: { ...baseState(), erdLayout: {} },
    projectId: 'p1',
    dispatch,
    setStatus: vi.fn(),
  });
  render(
    <MemoryRouter>
      <NewTableModal open onClose={() => {}} />
    </MemoryRouter>,
  );
}

function renderTable(table: Table, dispatch: ReturnType<typeof vi.fn>) {
  useProjectMock.mockReturnValue({
    state: { ...baseState(), tables: [table] },
    dispatch,
    canEdit: true,
    projectId: 'p1',
    setStatus: vi.fn(),
  });
  render(
    <MemoryRouter>
      <TableModal tableId={table.id} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe('U7 Comment + Unique di grid kolom', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
  });

  it('NewTableModal: comment per kolom tersimpan saat submit', () => {
    const dispatch = vi.fn();
    renderNew(dispatch);
    fireEvent.change(screen.getByPlaceholderText('users'), { target: { value: 'users' } });
    fireEvent.change(screen.getByPlaceholderText('name'), { target: { value: 'email' } });
    const comment = screen.getByLabelText(/Comment of|Komentar dari/) as HTMLInputElement;
    expect(comment.getAttribute('maxlength')).toBe(String(FE_LIMITS.COLUMN_COMMENT));
    expect(comment.getAttribute('placeholder')).toMatch(/comment|komentar/i);
    fireEvent.change(comment, { target: { value: 'pemilik akun' } });
    fireEvent.click(screen.getByRole('button', { name: /Create table|Buat tabel/ }));
    const add = dispatch.mock.calls.find((c) => c[0]?.type === 'table/add');
    expect(add?.[0]?.table?.columns?.[0]?.comment).toBe('pemilik akun');
  });

  it('TableModal: comment per kolom dispatch table/update', () => {
    const dispatch = vi.fn();
    renderTable(tableWith(), dispatch);
    const comment = screen.getByLabelText(/Comment of email|Komentar dari email/) as HTMLInputElement;
    expect(comment.value).toBe('');
    fireEvent.change(comment, { target: { value: 'kolom email utama' } });
    const upd = dispatch.mock.calls.find((c) => c[0]?.type === 'table/update');
    expect(upd?.[0]?.patch?.columns?.find((c: { id: string }) => c.id === 'c1')?.comment).toBe(
      'kolom email utama',
    );
    // kolom lain tak tersentuh
    expect(upd?.[0]?.patch?.columns?.find((c: { id: string }) => c.id === 'c2')?.comment).toBe('');
  });

  it('NewTableModal: unique off→on via B2, indexes lain dipertahankan', () => {
    const dispatch = vi.fn();
    renderNew(dispatch);
    fireEvent.change(screen.getByPlaceholderText('users'), { target: { value: 'users' } });
    fireEvent.change(screen.getByPlaceholderText('name'), { target: { value: 'email' } });
    fireEvent.change(screen.getByLabelText(/Indexes|Indeks/), { target: { value: 'created_at' } });
    const unique = screen.getByLabelText(/Unique for column email|Unique untuk kolom email/) as HTMLInputElement;
    expect(unique.checked).toBe(false);
    fireEvent.click(unique);
    fireEvent.click(screen.getByRole('button', { name: /Create table|Buat tabel/ }));
    const add = dispatch.mock.calls.find((c) => c[0]?.type === 'table/add');
    expect(add?.[0]?.table?.indexes).toEqual(['created_at', 'unique:email']);
  });

  it('NewTableModal: unique on→off menghapus entri itu saja', () => {
    const dispatch = vi.fn();
    renderNew(dispatch);
    fireEvent.change(screen.getByPlaceholderText('users'), { target: { value: 'users' } });
    fireEvent.change(screen.getByPlaceholderText('name'), { target: { value: 'email' } });
    fireEvent.change(screen.getByLabelText(/Indexes|Indeks/), {
      target: { value: 'created_at, unique:email, unique:name' },
    });
    const unique = screen.getByLabelText(/Unique for column email|Unique untuk kolom email/) as HTMLInputElement;
    expect(unique.checked).toBe(true);
    fireEvent.click(unique);
    fireEvent.click(screen.getByRole('button', { name: /Create table|Buat tabel/ }));
    const add = dispatch.mock.calls.find((c) => c[0]?.type === 'table/add');
    expect(add?.[0]?.table?.indexes).toEqual(['created_at', 'unique:name']);
  });

  it('TableModal: unique on→off via toggleUnique, entri lain dipertahankan', () => {
    const dispatch = vi.fn();
    renderTable(
      tableWith({ indexes: ['created_at', 'unique:email', 'unique:name'] }),
      dispatch,
    );
    const unique = screen.getByLabelText(/Unique for column email|Unique untuk kolom email/) as HTMLInputElement;
    expect(unique.checked).toBe(true);
    fireEvent.click(unique);
    const upd = dispatch.mock.calls.find((c) => c[0]?.type === 'table/update');
    expect(upd?.[0]?.patch?.indexes).toEqual(['created_at', 'unique:name']);
  });

  it('TableModal: unique off→on append unique:<col>', () => {
    const dispatch = vi.fn();
    renderTable(tableWith({ indexes: ['created_at'] }), dispatch);
    const unique = screen.getByLabelText(/Unique for column email|Unique untuk kolom email/) as HTMLInputElement;
    expect(unique.checked).toBe(false);
    fireEvent.click(unique);
    const upd = dispatch.mock.calls.find((c) => c[0]?.type === 'table/update');
    expect(upd?.[0]?.patch?.indexes).toEqual(['created_at', 'unique:email']);
  });

  it('Unique disabled saat nama kolom kosong (kedua modal) + comment selalu aktif', () => {
    // NewTableModal: baris awal nama kosong
    const dispatch = vi.fn();
    renderNew(dispatch);
    const uniqueEmpty = screen.getByLabelText(
      /Unique for column unnamed|Unique untuk kolom tanpa nama/,
    ) as HTMLInputElement;
    expect(uniqueEmpty.disabled).toBe(true);
    expect(uniqueEmpty.closest('label')?.getAttribute('title')).toMatch(/nama kolom|column name/i);
    const commentEmpty = screen.getByLabelText(/Comment of|Komentar dari/) as HTMLInputElement;
    expect(commentEmpty.disabled).toBe(false);
    // isi nama → unique aktif
    fireEvent.change(screen.getByPlaceholderText('name'), { target: { value: 'email' } });
    expect(
      (screen.getByLabelText(/Unique for column email|Unique untuk kolom email/) as HTMLInputElement).disabled,
    ).toBe(false);
  });
});
