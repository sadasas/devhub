import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, Whiteboard } from '../../lib/types';
import { WhiteboardEditorShell } from './WhiteboardEditorShell';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
  useProjectOptional: useProjectMock,
}));

function makeState(): State {
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
  } as unknown as State;
}

function boardWith(elements: Whiteboard['elements']): Whiteboard {
  return {
    id: 'wb1',
    name: 'Embed board',
    description: '',
    elements,
    createdAt: '2026-08-14T00:00:00.000Z',
    updatedAt: '2026-08-14T00:00:00.000Z',
    authorId: null,
  } as unknown as Whiteboard;
}

beforeEach(() => {
  useProjectMock.mockReturnValue({ state: null, role: 'owner', canEdit: true, dispatch: vi.fn() });
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: vi.fn(), configurable: true });
});

describe('whiteboard canvas embed', () => {
  it('me-render SVG AI tersarang dan membuang script', () => {
    const { container } = render(
      <MemoryRouter>
        <WhiteboardEditorShell
          board={boardWith([
            {
              id: 'e1',
              kind: 'embed',
              x: 0,
              y: 0,
              w: 360,
              h: 520,
              title: 'Login form',
              svg: '<rect x="10" y="10" width="340" height="500" fill="#111214"/><text x="180" y="62">Login</text><script>alert(1)</script>',
            },
          ])}
          state={makeState()}
          onBack={() => {}}
        />
      </MemoryRouter>,
    );
    const nested = container.querySelector('svg.wb-svg svg');
    expect(nested).not.toBeNull();
    expect(nested?.innerHTML).toContain('fill="#111214"');
    expect(nested?.innerHTML).toContain('Login');
    expect(nested?.innerHTML).not.toContain('alert');
  });

  it('fallback box bila svg kosong', () => {
    const { container } = render(
      <MemoryRouter>
        <WhiteboardEditorShell
          board={boardWith([
            { id: 'e1', kind: 'embed', x: 0, y: 0, w: 360, h: 520, title: 'Kartu', svg: '<script>x()</script>' },
          ])}
          state={makeState()}
          onBack={() => {}}
        />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('Kartu');
  });

  it('menampilkan hint grouping saat embed tanpa grup diklik kanan', () => {
    render(
      <MemoryRouter>
        <WhiteboardEditorShell
          board={boardWith([
            {
              id: 'e1',
              kind: 'embed',
              x: 0,
              y: 0,
              w: 360,
              h: 520,
              title: 'Form',
              svg: '<rect x="10" y="10" width="100" height="50"/>',
            },
          ])}
          state={makeState()}
          onBack={() => {}}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 560 });
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 560 });
    fireEvent.contextMenu(svg, { clientX: 100, clientY: 100 });
    const hint = screen.getByRole('menuitem', {
      name: 'Tip: wrap widgets in <g data-component> to allow splitting',
    }) as HTMLButtonElement;
    expect(hint).not.toBeNull();
    expect(hint.disabled).toBe(true);
  });

  it('tidak menampilkan hint bila embed sudah dikelompokkan', () => {
    render(
      <MemoryRouter>
        <WhiteboardEditorShell
          board={boardWith([
            {
              id: 'e1',
              kind: 'embed',
              x: 0,
              y: 0,
              w: 360,
              h: 520,
              title: 'Form',
              svg: '<g data-component="card"><rect x="10" y="10" width="100" height="50"/></g>',
            },
          ])}
          state={makeState()}
          onBack={() => {}}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select area — M' }));
    const svg = document.querySelector('svg.wb-svg') as SVGSVGElement;
    fireEvent.pointerDown(svg, { button: 0, clientX: 16, clientY: 16 });
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 560 });
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 560 });
    fireEvent.contextMenu(svg, { clientX: 100, clientY: 100 });
    expect(
      screen.queryByRole('menuitem', {
        name: 'Tip: wrap widgets in <g data-component> to allow splitting',
      }),
    ).toBeNull();
  });
});
