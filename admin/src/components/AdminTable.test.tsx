import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AdminTable } from './AdminTable';
import { formatIdr } from '../lib/format';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const cols = [
  { key: 'name', label: 'Package', render: (r: Row) => r.name },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right' as const,
    numeric: true,
    render: (r: Row) => <span className="tabular">{formatIdr(r.amount)}</span>,
  },
];

describe('AdminTable', () => {
  it('renders semantic table with sticky thead and right-aligned IDR', () => {
    render(
      <AdminTable<Row>
        caption="Packages"
        columns={cols}
        rows={[{ id: '1', name: 'Pro', amount: 250000 }]}
        getRowId={(r) => r.id}
        isFiltered={false}
        emptyFilteredTitle="No match"
        emptyTotalTitle="Empty"
        emptyTotalDesc="None"
      />,
    );
    const table = document.querySelector('table.admin-table');
    expect(table).not.toBeNull();
    expect(document.querySelector('.admin-table-wrap')).not.toBeNull();
    // thead sticky via CSS class (position sticky di global.css)
    expect(screen.getByText('Package')).toBeDefined();
    expect(screen.getByText('Rp 250.000')).toBeDefined();
    const td = screen.getByText('Rp 250.000').closest('td');
    expect(td?.className).toMatch(/num/);
    expect(td?.className).toMatch(/tabular|align-right/);
  });

  it('distinguishes empty-filtered vs empty-total with reset action', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <AdminTable<Row>
        caption="Packages"
        columns={cols}
        rows={[]}
        getRowId={(r) => r.id}
        isFiltered
        emptyFilteredTitle="No packages match"
        emptyFilteredDesc="Try another filter"
        emptyTotalTitle="No packages"
        emptyTotalDesc="Create one"
        onResetFilters={onReset}
      />,
    );
    expect(screen.getByText('No packages match')).toBeDefined();
    const resetBtn = screen.getByRole('button', { name: /Reset filters|Atur ulang/ });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <AdminTable<Row>
        caption="Packages"
        columns={cols}
        rows={[]}
        getRowId={(r) => r.id}
        isFiltered={false}
        emptyFilteredTitle="No packages match"
        emptyTotalTitle="No packages"
        emptyTotalDesc="Create one"
        onResetFilters={onReset}
      />,
    );
    expect(screen.getByText('No packages')).toBeDefined();
    // kosong-total tanpa filter → tanpa aksi reset
    expect(screen.queryByRole('button', { name: /Reset filters|Atur ulang/ })).toBeNull();
  });

  it('supports aria-sort and dimmed rows (inactive Opsi B)', () => {
    render(
      <AdminTable<Row>
        caption="Packages"
        columns={[{ key: 'amount', label: 'Amount', sortable: true, numeric: true, render: (r) => String(r.amount) }]}
        rows={[{ id: '1', name: 'Free', amount: 0 }]}
        getRowId={(r) => r.id}
        sortKey="amount"
        sortDir="desc"
        onSort={() => {}}
        getRowDimmed={() => true}
        isFiltered={false}
        emptyFilteredTitle="x"
        emptyTotalTitle="y"
      />,
    );
    expect(document.querySelector('th[aria-sort="descending"]')).not.toBeNull();
    expect(document.querySelector('tr.is-dim')).not.toBeNull();
  });
});
