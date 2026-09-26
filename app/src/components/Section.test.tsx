import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Gear } from '@phosphor-icons/react';
import { PageHeader } from './PageHeader';
import { Section, SettingsRowGroup } from './Section';

describe('PageHeader (kanonis Tier-1 §4b)', () => {
  it('judul h1 + subjudul + aksi kanan sesuai urutan', () => {
    render(
      <PageHeader
        title="Keys"
        subtitle="Manage tokens"
        actions={<span className="data-list-count">3 connected</span>}
      />,
    );
    const header = screen.getByRole('banner');
    expect(header.tagName).toBe('HEADER');
    expect(header.className).toContain('page-header');
    const kids = Array.from(header.children).map((el) => el.tagName);
    expect(kids).toEqual(['DIV', 'SPAN']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Keys');
    expect(header.textContent).toContain('Manage tokens');
    expect(header.textContent).toContain('3 connected');
  });

  it('tanpa subtitle/aksi: hanya blok judul', () => {
    render(<PageHeader title="Keys" />);
    const header = screen.getByRole('banner');
    expect(header.children).toHaveLength(1);
    expect(header.querySelector('.page-subtitle')).toBeNull();
  });

  it('className modifier halaman diteruskan', () => {
    render(<PageHeader title="Keys" className="billing-header" />);
    expect(screen.getByRole('banner').className).toContain('billing-header');
  });
});

describe('Section (kanonis Tier-1 §7)', () => {
  it('section berlabel: aria-labelledby + h2 id + fokus -1', () => {
    render(
      <Section titleId="s-general" title="General" description="Desc here">
        <p>Body</p>
      </Section>,
    );
    const section = screen.getByRole('region', { name: 'General' });
    expect(section.getAttribute('aria-labelledby')).toBe('s-general');
    const h2 = screen.getByRole('heading', { level: 2, name: 'General' });
    expect(h2.getAttribute('id')).toBe('s-general');
    expect(h2.getAttribute('tabindex')).toBe('-1');
    expect(h2.className).toContain('dashboard__settings-section-title');
    expect(section.textContent).toContain('Desc here');
    expect(section.textContent).toContain('Body');
  });

  it('tanpa actions: h2 tanpa head-row (pola danger/plan)', () => {
    render(
      <Section titleId="s-plan" title="Plan">
        <p>Body</p>
      </Section>,
    );
    expect(screen.getByRole('region', { name: 'Plan' }).querySelector('.dashboard__settings-head')).toBeNull();
  });

  it('dengan actions: h2 dibungkus head-row + aksi di kanan', () => {
    const onEdit = vi.fn();
    render(
      <Section titleId="s-labels" title="Labels" actions={<button type="button" onClick={onEdit}>Add</button>}>
        <p>Body</p>
      </Section>,
    );
    const section = screen.getByRole('region', { name: 'Labels' });
    const head = section.querySelector('.dashboard__settings-head');
    expect(head).not.toBeNull();
    expect(Array.from(head?.children ?? []).map((el) => el.tagName)).toEqual(['H2', 'BUTTON']);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('variant danger: modifier section + judul merah', () => {
    render(
      <Section titleId="s-danger" title="Danger zone" variant="danger">
        <p>Body</p>
      </Section>,
    );
    const section = screen.getByRole('region', { name: 'Danger zone' });
    expect(section.className).toContain('dashboard__settings-section--danger');
    expect(screen.getByRole('heading', { level: 2 }).className).toContain(
      'dashboard__settings-section-title--danger',
    );
  });

  it('icon: modifier with-icon pada h2', () => {
    render(
      <Section titleId="s-icon" title="General" icon={<Gear size={14} aria-hidden="true" />}>
        <p>Body</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { level: 2 }).className).toContain(
      'dashboard__settings-section-title--with-icon',
    );
  });

  it('id deep-link diteruskan ke section', () => {
    render(
      <Section titleId="s-usage" title="Usage" id="dashboard-settings-usage">
        <p>Body</p>
      </Section>,
    );
    expect(screen.getByRole('region', { name: 'Usage' }).getAttribute('id')).toBe(
      'dashboard-settings-usage',
    );
  });

  it('tanpa description: tidak ada paragraf desc', () => {
    render(
      <Section titleId="s-nodesc" title="Plan">
        <p>Body</p>
      </Section>,
    );
    expect(
      screen.getByRole('region', { name: 'Plan' }).querySelector('.dashboard__settings-section-desc'),
    ).toBeNull();
  });
});

describe('SettingsRowGroup', () => {
  it('bungkus baris berkelompok + className tambahan', () => {
    render(
      <SettingsRowGroup className="extra">
        <p>Row</p>
      </SettingsRowGroup>,
    );
    const group = screen.getByText('Row').parentElement;
    expect(group?.className).toContain('settings-row-group');
    expect(group?.className).toContain('extra');
  });
});
