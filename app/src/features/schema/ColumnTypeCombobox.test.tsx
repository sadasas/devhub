import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ColumnTypeCombobox } from './ColumnTypeCombobox';
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

function tableWithColumns(columns: Table['columns']): Table {
  return {
    id: 'tb1',
    name: 'users',
    comment: '',
    columns,
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('U6 ColumnTypeCombobox', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
  });

  it('kosong → placeholder + tak memilih apa-apa (tanpa input custom)', () => {
    render(
      <ColumnTypeCombobox
        id="ct-empty"
        value=""
        onChange={() => {}}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    // typePlaceholder en = "uuid"
    expect(screen.getByRole('button', { name: 'Type' }).textContent).toContain('uuid');
    expect(screen.queryByLabelText('Custom type')).toBeNull();
  });

  it('nilai terdaftar → tampil terpilih tanpa input custom', () => {
    render(
      <ColumnTypeCombobox
        id="ct-known"
        value="TEXT"
        onChange={() => {}}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    expect(screen.getByRole('button', { name: 'Type' }).textContent).toContain('TEXT');
    expect(screen.queryByLabelText('Custom type')).toBeNull();
  });

  it('pilih dari list → onChange string tipe (kontrak tetap string)', () => {
    const onChange = vi.fn();
    render(
      <ColumnTypeCombobox
        id="ct-pick"
        value=""
        onChange={onChange}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    fireEvent.click(screen.getByRole('option', { name: /VARCHAR/ }));
    expect(onChange).toHaveBeenCalledWith('VARCHAR');
  });

  it('opsi Custom… → input bebas muncul, nilai custom tersimpan apa adanya + maxLength tetap', () => {
    const onChange = vi.fn();
    render(
      <ColumnTypeCombobox
        id="ct-custom"
        value=""
        onChange={onChange}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    fireEvent.click(screen.getByRole('option', { name: /Custom|Kustom/ }));
    const input = screen.getByLabelText('Custom type') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute('maxlength')).toBe(String(FE_LIMITS.COLUMN_TYPE));
    fireEvent.change(input, { target: { value: 'varchar(255)' } });
    expect(onChange).toHaveBeenCalledWith('varchar(255)');
  });

  it('unknown CIRCLE → jujur: trigger Custom + input menampilkan CIRCLE', () => {
    render(
      <ColumnTypeCombobox
        id="ct-unknown"
        value="CIRCLE"
        onChange={() => {}}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    expect(screen.getByRole('button', { name: 'Type' }).textContent).toMatch(/Custom|Kustom/);
    const input = screen.getByLabelText('Custom type') as HTMLInputElement;
    expect(input.value).toBe('CIRCLE');
  });

  it('varchar(255) → mode custom (param dipertahankan jujur)', () => {
    render(
      <ColumnTypeCombobox
        id="ct-sized"
        value="varchar(255)"
        onChange={() => {}}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    const input = screen.getByLabelText('Custom type') as HTMLInputElement;
    expect(input.value).toBe('varchar(255)');
  });

  it('daftar berisi group label i18n sebagai hint', () => {
    render(
      <ColumnTypeCombobox
        id="ct-group"
        value=""
        onChange={() => {}}
        ariaLabel="Type"
        customAriaLabel="Custom type"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    const varchar = screen.getByRole('option', { name: /VARCHAR/ });
    // hint = group label "Character" (en)
    expect(varchar.textContent).toContain('Character');
    // opsi terakhir adalah Custom…
    const options = screen.getAllByRole('option');
    expect(options[options.length - 1]?.textContent).toMatch(/Custom|Kustom/);
  });

  it('NewTableModal: grid memakai combobox + pilih list tersimpan string saat submit', () => {
    const dispatch = vi.fn();
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
    // Satu baris awal: trigger combobox dengan aria "Type of column"
    const trigger = screen.getByRole('button', { name: /Type of/ });
    expect(trigger.textContent).toContain('uuid');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /^UUID/ }));
    expect(screen.getByRole('button', { name: /Type of/ }).textContent).toContain('UUID');
    // Kontrak tetap string: submit membawa type string UUID
    fireEvent.change(screen.getByPlaceholderText('users'), { target: { value: 'orders' } });
    fireEvent.change(screen.getByPlaceholderText('name'), { target: { value: 'id' } });
    fireEvent.click(screen.getByRole('button', { name: /Create table|Buat tabel/ }));
    const add = dispatch.mock.calls.find((c) => c[0]?.type === 'table/add');
    expect(typeof add?.[0]?.table?.columns?.[0]?.type).toBe('string');
    expect(add?.[0]?.table?.columns?.[0]?.type).toBe('UUID');
  });

  it('TableModal: grid edit memakai combobox, unknown jujur + update string', () => {
    const dispatch = vi.fn();
    const state = {
      ...baseState(),
      tables: [
        tableWithColumns([
          { id: 'c1', name: 'id', type: 'CIRCLE', nullable: true, primaryKey: false, comment: '', default: null },
        ]),
      ],
    };
    useProjectMock.mockReturnValue({
      state,
      dispatch,
      canEdit: true,
      projectId: 'p1',
      setStatus: vi.fn(),
    });
    render(
      <MemoryRouter>
        <TableModal tableId="tb1" onClose={() => {}} />
      </MemoryRouter>,
    );
    // Trigger edit + input custom jujur CIRCLE
    expect(screen.getByRole('button', { name: /Type of id/ }).textContent).toMatch(/Custom|Kustom/);
    const custom = screen.getByLabelText(/Custom type of id|Tipe kustom dari id/) as HTMLInputElement;
    expect(custom.value).toBe('CIRCLE');
    expect(custom.getAttribute('maxlength')).toBe(String(FE_LIMITS.COLUMN_TYPE));
    // Ketik domain custom → dispatch string apa adanya
    fireEvent.change(custom, { target: { value: 'mydomain' } });
    const upd = dispatch.mock.calls.find((c) => c[0]?.type === 'table/update');
    expect(upd?.[0]?.patch?.columns?.[0]?.type).toBe('mydomain');
  });
});
