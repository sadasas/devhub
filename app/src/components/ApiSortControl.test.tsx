import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiSortControl } from './ApiSortControl';

const OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created' },
];

function renderControl(overrides?: {
  collectionsValue?: { key: string; dir: 'asc' | 'desc' } | null;
  endpointsValue?: { key: string; dir: 'asc' | 'desc' } | null;
  onCollections?: (v: { key: string; dir: 'asc' | 'desc' } | null) => void;
  onEndpoints?: (v: { key: string; dir: 'asc' | 'desc' } | null) => void;
}) {
  const onCollections = overrides?.onCollections ?? (() => {});
  const onEndpoints = overrides?.onEndpoints ?? (() => {});
  render(
    <ApiSortControl
      collections={{ label: 'Collections', options: OPTIONS, value: overrides?.collectionsValue ?? null, onChange: onCollections }}
      endpoints={{ label: 'Endpoints', options: OPTIONS, value: overrides?.endpointsValue ?? null, onChange: onEndpoints }}
    />,
  );
  return { onCollections, onEndpoints };
}

describe('ApiSortControl', () => {
  it('renders a single trigger for both sections', () => {
    renderControl();
    expect(screen.getAllByRole('button', { name: 'Sort' }).length).toBe(1);
  });

  it('shows the badge only when a section has an explicit sort', () => {
    const { rerender } = render(
      <ApiSortControl
        collections={{ label: 'Collections', options: OPTIONS, value: null, onChange: () => {} }}
        endpoints={{ label: 'Endpoints', options: OPTIONS, value: null, onChange: () => {} }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Sort · 2' })).toBeNull();
    rerender(
      <ApiSortControl
        collections={{ label: 'Collections', options: OPTIONS, value: { key: 'name', dir: 'asc' }, onChange: () => {} }}
        endpoints={{ label: 'Endpoints', options: OPTIONS, value: { key: 'name', dir: 'desc' }, onChange: () => {} }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sort · 2' })).toBeTruthy();
  });

  it('commits each section without closing the menu', () => {
    const onCollections = vi.fn();
    const onEndpoints = vi.fn();
    renderControl({ onCollections, onEndpoints });
    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    // pick collections key (pending), then direction (commit, menu stays open)
    const nameRows = screen.getAllByRole('menuitemradio', { name: 'Name' });
    fireEvent.click(nameRows[0]!);
    expect(onCollections).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Descending' }));
    expect(onCollections).toHaveBeenCalledWith({ key: 'name', dir: 'desc' });
    expect(screen.getByRole('menu')).toBeTruthy();
    // endpoints section is independent
    const createdRows = screen.getAllByRole('menuitemradio', { name: 'Created' });
    expect(createdRows.length).toBe(2);
  });

  it('closes the menu on Escape', () => {
    renderControl();
    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
