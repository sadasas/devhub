import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaExportMenu } from './SchemaExportMenu';
import type { Relation, Table } from '../../lib/types';

function table(over: Partial<Table> = {}): Table {
  return {
    id: 'tb1',
    name: 'users',
    comment: '',
    columns: [
      {
        id: 'c1',
        name: 'id',
        type: 'UUID',
        nullable: false,
        primaryKey: true,
        default: null,
        comment: '',
      },
    ],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function relation(over: Partial<Relation> = {}): Relation {
  return {
    id: 'r1',
    fromTableId: 'tb1',
    fromColumnId: 'c1',
    toTableId: 'tb2',
    toColumnId: 'c2',
    cardinality: '1:N',
    onDelete: 'cascade',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('SchemaExportMenu', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:mock');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      // capture download attr via `this`
    });
  });

  afterEach(() => {
    clickSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders an Export trigger with menu semantics', () => {
    render(<SchemaExportMenu tables={[table()]} relations={[]} projectName="Demo" />);
    const trigger = screen.getByRole('button', { name: /Export schema as/i });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.className).toContain('btn-ghost');
    expect(trigger.className).toContain('btn-sm');
  });

  it('opens a menu with DDL/DBML/SVG/PNG active', () => {
    render(<SchemaExportMenu tables={[table()]} relations={[]} projectName="Demo" />);
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));
    const menu = screen.getByRole('menu', { name: /Export schema as/i });
    expect(menu).toBeTruthy();

    const ddl = screen.getByRole('menuitem', { name: 'Postgres DDL (.sql)' });
    expect((ddl as HTMLButtonElement).disabled).toBe(false);

    const dbml = screen.getByRole('menuitem', { name: 'DBML (.dbml)' });
    expect((dbml as HTMLButtonElement).disabled).toBe(false);
    expect(dbml.getAttribute('title')).toBeNull();

    const svg = screen.getByRole('menuitem', { name: 'SVG' });
    expect((svg as HTMLButtonElement).disabled).toBe(false);
    expect(svg.getAttribute('title')).toBeNull();

    const png = screen.getByRole('menuitem', { name: 'PNG 2x' });
    expect((png as HTMLButtonElement).disabled).toBe(false);
    expect(png.getAttribute('title')).toBeNull();
  });

  it('disables only SVG/PNG when there are no tables (DDL stays active)', () => {
    render(<SchemaExportMenu tables={[]} relations={[]} projectName="Demo" />);
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));

    const ddl = screen.getByRole('menuitem', { name: 'Postgres DDL (.sql)' });
    expect((ddl as HTMLButtonElement).disabled).toBe(false);

    const svg = screen.getByRole('menuitem', { name: 'SVG' });
    expect((svg as HTMLButtonElement).disabled).toBe(true);

    const png = screen.getByRole('menuitem', { name: 'PNG 2x' });
    expect((png as HTMLButtonElement).disabled).toBe(true);
  });

  it('downloads live ERD SVG with a slugged *-erd filename', async () => {
    let downloaded = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    render(<SchemaExportMenu tables={[table()]} relations={[]} projectName="Demo Project" />);
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'SVG' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('image/svg+xml');
    const text = await blob.text();
    expect(text).toContain('<svg');
    expect(text).toContain('users');
    expect(downloaded).toBe('demo-project-schema-erd.svg');
  });

  it('downloads versioned ERD PNG 2x with a slugged *-erd filename', () => {
    let downloaded = '';
    let href = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
      href = this.href;
    });
    // Stub Image so onload fires synchronously with a natural size (jsdom never loads blob URLs).
    class FakeImage {
      naturalWidth = 272;
      naturalHeight = 148;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      get src(): string {
        return this._src;
      }
      set src(_v: string) {
        this._src = _v;
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', FakeImage);
    // jsdom canvas has no 2d context; stub the offscreen canvas used for the 2x raster.
    const drawImage = vi.fn();
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL: () => 'data:image/png;base64,AAA',
    };
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      ((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'canvas') return fakeCanvas as unknown as HTMLElement;
        return origCreateElement(tagName, options);
      }) as typeof document.createElement,
    );

    render(
      <SchemaExportMenu
        tables={[table({ id: 'snap1', name: 'snap_users' })]}
        relations={[]}
        projectName="Demo Project"
        versionLabel="v1.2.0"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Export v1\.2\.0 as/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'PNG 2x' }));

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(fakeCanvas.width).toBe(544);
    expect(fakeCanvas.height).toBe(296);
    expect(href).toBe('data:image/png;base64,AAA');
    expect(downloaded).toBe('demo-project-schema-v1-2-0-erd.png');
  });

  it('downloads live DDL via Blob with a slugged filename', async () => {
    let downloaded = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    render(<SchemaExportMenu tables={[table()]} relations={[relation()]} projectName="Demo Project" />);
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Postgres DDL (.sql)' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/sql');
    const text = await blob.text();
    expect(text).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(downloaded).toBe('demo-project-schema.sql');
  });

  it('downloads live DBML via Blob with a slugged *-schema.dbml filename', async () => {
    let downloaded = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    render(<SchemaExportMenu tables={[table()]} relations={[relation()]} projectName="Demo Project" />);
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'DBML (.dbml)' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('text/plain');
    const text = await blob.text();
    expect(text).toContain('Table users {');
    expect(text).toContain('id UUID [pk]');
    expect(downloaded).toBe('demo-project-schema.dbml');
  });

  it('uses snapshot tables and a versioned label + filename when viewing ?v=', async () => {
    let downloaded = '';
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    const snapTable = table({ id: 'snap1', name: 'snap_users' });
    render(
      <SchemaExportMenu tables={[snapTable]} relations={[]} projectName="Demo Project" versionLabel="v1.2.0" />,
    );
    expect(screen.getByRole('button', { name: /Export v1\.2\.0 as/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Export v1\.2\.0 as/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Postgres DDL (.sql)' }));

    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    const text = await blob.text();
    expect(text).toContain('snap_users');
    expect(text).not.toContain('CREATE TABLE IF NOT EXISTS users (');
    expect(downloaded).toBe('demo-project-schema-v1-2-0.sql');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<SchemaExportMenu tables={[table()]} relations={[]} projectName="Demo" />);
    const trigger = screen.getByRole('button', { name: /Export schema as/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside click', () => {
    render(
      <div>
        <SchemaExportMenu tables={[table()]} relations={[]} projectName="Demo" />
        <button type="button">outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    // pointerdown on body is inside wrap? body is outside, so menu should close
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('still downloads a non-empty file when the schema is empty', async () => {
    render(<SchemaExportMenu tables={[]} relations={[]} projectName="" />);
    fireEvent.click(screen.getByRole('button', { name: /Export schema as/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Postgres DDL (.sql)' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    const text = await blob.text();
    expect(text.trim().length).toBeGreaterThan(0);
  });
});
