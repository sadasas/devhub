import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useCanvasView, type CanvasViewOptions } from './useCanvasView';

function Probe({ opts }: { opts?: CanvasViewOptions }) {
  const v = useCanvasView(true, opts);
  return (
    <div>
      <svg
        ref={v.ref}
        data-testid="cv"
        width={200}
        height={200}
        onPointerDown={v.onPointerDown}
        onPointerMove={v.onPointerMove}
        onPointerUp={v.onPointerUp}
        onPointerCancel={v.onPointerCancel}
      />
      <span data-testid="v">{`${v.view.x},${v.view.y},${v.view.s}`}</span>
      <button type="button" onClick={() => v.zoomAt(2)}>
        zin
      </button>
      <button type="button" onClick={() => v.resetView()}>
        reset
      </button>
    </div>
  );
}

function viewOf(): [number, number, number] {
  return screen.getByTestId('v').textContent!.split(',').map(Number) as [number, number, number];
}

describe('WB-12 useCanvasView', () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    });
  });

  it('starts at the default view', () => {
    render(<Probe />);
    expect(viewOf()).toEqual([16, 16, 1]);
  });

  it('zooms in at the cursor on wheel up', () => {
    render(<Probe />);
    fireEvent.wheel(screen.getByTestId('cv'), { deltaY: -100, clientX: 116, clientY: 116 });
    const [x, y, s] = viewOf();
    expect(s).toBeCloseTo(1.12, 10);
    expect(x).toBeCloseTo(4, 8);
    expect(y).toBeCloseTo(4, 8);
  });

  it('zooms out with the default factor', () => {
    render(<Probe />);
    fireEvent.wheel(screen.getByTestId('cv'), { deltaY: 100, clientX: 16, clientY: 16 });
    const [, , s] = viewOf();
    expect(s).toBeCloseTo(1 / 1.12, 10);
  });

  it('honors a custom zoom-out factor (schema ERD uses 0.89)', () => {
    render(<Probe opts={{ zoomOutFactor: 0.89 }} />);
    fireEvent.wheel(screen.getByTestId('cv'), { deltaY: 100, clientX: 16, clientY: 16 });
    expect(viewOf()[2]).toBeCloseTo(0.89, 10);
  });

  it('pans on pointer drag and resets on demand', () => {
    render(<Probe />);
    const svg = screen.getByTestId('cv');
    fireEvent.pointerDown(svg, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { clientX: 15, clientY: 17 });
    fireEvent.pointerUp(svg);
    expect(viewOf()).toEqual([21, 23, 1]);
    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(viewOf()).toEqual([16, 16, 1]);
  });

  it('zooms at the center via zoomAt', () => {
    render(<Probe />);
    fireEvent.click(screen.getByRole('button', { name: 'zin' }));
    const [x, y, s] = viewOf();
    // jsdom rect is zero-size: center (0,0) over default view
    expect(s).toBe(2);
    expect(x).toBe(32);
    expect(y).toBe(32);
  });
});
