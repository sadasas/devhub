import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  AlignDropdown,
  AlignSegmented,
  DropdownShell,
  ERASER_WIDTH_PRESETS,
  FontDropdown,
  SizeDropdown,
  TextStyleToggles,
  ValignDropdown,
  ValignSegmented,
  WIDTH_PRESETS,
  WidthGlyph,
  WidthPresets,
} from './WhiteboardTextControls';

describe('whiteboard text controls', () => {
  it('picks a typeface from the font dropdown', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<FontDropdown value="simple" open={false} onToggle={() => {}} onClose={onClose} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Font' }));
    // closed: no dialog yet (parent owns the open state)
    expect(screen.queryByRole('dialog', { name: 'Font' })).toBeNull();
    const { unmount } = render(
      <FontDropdown value="simple" open onToggle={() => {}} onClose={onClose} onPick={onPick} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Font' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Scribbled/ }));
    expect(onPick).toHaveBeenCalledWith('scribbled');
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('picks a size preset and commits a custom numeric size', () => {
    const onPick = vi.fn();
    render(<SizeDropdown value={16} open onToggle={() => {}} onClose={() => {}} onPick={onPick} />);
    const dialog = screen.getByRole('dialog', { name: 'Text size' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Large/ }));
    expect(onPick).toHaveBeenCalledWith(40);
    const input = within(dialog).getByRole('textbox', { name: 'Custom size' });
    fireEvent.change(input, { target: { value: '33' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(33);
    // out-of-range input clamps to 96
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(96);
  });

  it('marks the active size row and steps the custom input', () => {
    const onPick = vi.fn();
    render(<SizeDropdown value={24} open onToggle={() => {}} onClose={() => {}} onPick={onPick} />);
    const dialog = screen.getByRole('dialog', { name: 'Text size' });
    expect(within(dialog).getByRole('radio', { name: /Medium/ }).getAttribute('aria-checked')).toBe('true');
    const input = within(dialog).getByRole('textbox', { name: 'Custom size' });
    expect((input as HTMLInputElement).value).toBe('24');
  });

  it('shows the preset name on the button when matched, number for custom sizes', () => {
    const noop = () => {};
    const { unmount } = render(<SizeDropdown value={16} open={false} onToggle={noop} onClose={noop} onPick={noop} />);
    expect(screen.getByRole('button', { name: 'Text size' }).textContent).toContain('Small');
    unmount();
    render(<SizeDropdown value={20} open={false} onToggle={noop} onClose={noop} onPick={noop} />);
    expect(screen.getByRole('button', { name: 'Text size' }).textContent).toContain('20');
  });

  it('keeps the dropdown caret small against 15px property icons (FigJam contrast)', () => {
    const noop = () => {};
    render(<SizeDropdown value={16} open={false} onToggle={noop} onClose={noop} onPick={noop} />);
    const caret = document.querySelector('button[aria-label="Text size"] svg.wb-caret');
    expect(caret?.getAttribute('width')).toBe('10');
  });

  it('changes alignment via the dropdown popup', () => {
    const onChange = vi.fn();
    const onToggle = vi.fn();
    render(<AlignDropdown value="left" open={false} onToggle={onToggle} onClose={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Text alignment' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    const { unmount } = render(
      <AlignDropdown value="left" open onToggle={() => {}} onClose={() => {}} onChange={onChange} />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Text alignment' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Center' }));
    expect(onChange).toHaveBeenCalledWith('center');
    unmount();
  });

  it('changes vertical alignment via the valign dropdown popup', () => {
    const onChange = vi.fn();
    const onToggle = vi.fn();
    render(<ValignDropdown value="top" open={false} onToggle={onToggle} onClose={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vertical alignment' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    const { unmount } = render(
      <ValignDropdown value="top" open onToggle={() => {}} onClose={() => {}} onChange={onChange} />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Vertical alignment' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Bottom' }));
    expect(onChange).toHaveBeenCalledWith('bottom');
    unmount();
  });

  it('changes vertical alignment via the valign segmented control', () => {
    const onChange = vi.fn();
    render(<ValignSegmented value="top" onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Vertical alignment' });
    expect(within(group).getByRole('radio', { name: 'Top' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Bottom' }));
    expect(onChange).toHaveBeenCalledWith('bottom');
  });

  it('keeps the inline segmented control for the strip', () => {    const onChange = vi.fn();
    render(<AlignSegmented value="left" onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Text alignment' });
    expect(within(group).getByRole('radio', { name: 'Left' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: 'Center' }));
    expect(onChange).toHaveBeenCalledWith('center');
  });

  it('toggles bold, strikethrough and bullets', () => {
    const onBold = vi.fn();
    const onStrikethrough = vi.fn();
    const onBullet = vi.fn();
    render(
      <TextStyleToggles bold={false} strikethrough={false} bullet={false} onBold={onBold} onStrikethrough={onStrikethrough} onBullet={onBullet} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Strikethrough' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(onBold).toHaveBeenCalledTimes(1);
    expect(onStrikethrough).toHaveBeenCalledTimes(1);
    expect(onBullet).toHaveBeenCalledTimes(1);
  });

  it('offers custom width preset options (eraser 4–20)', () => {
    expect(WIDTH_PRESETS).toEqual([1, 2, 4, 8, 16]);
    expect(ERASER_WIDTH_PRESETS).toEqual([4, 8, 12, 16, 20]);
    const onPick = vi.fn();
    render(<WidthPresets value={6} options={ERASER_WIDTH_PRESETS} label="Width" onPick={onPick} />);
    const group = screen.getByRole('radiogroup', { name: 'Width' });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    // custom value matches nothing yet; picking snaps to a preset
    expect(within(group).queryByRole('radio', { name: '6' })).toBeNull();
    fireEvent.click(within(group).getByRole('radio', { name: '12' }));
    expect(onPick).toHaveBeenCalledWith(12);
  });

  it('renders a live thickness glyph for width buttons (no bare number)', () => {
    const { unmount } = render(<WidthGlyph value={8} />);
    const line = document.querySelector('line');
    expect(line?.getAttribute('stroke-width')).toBe('8');
    expect(document.body.textContent).not.toContain('8');
    unmount();
    // values above the glyph cap still render, capped at 10
    render(<WidthGlyph value={20} />);
    expect(document.querySelector('line')?.getAttribute('stroke-width')).toBe('10');
  });

  it('renders a generic dropdown shell with portal popup', () => {
    const onToggle = vi.fn();
    render(
      <DropdownShell
        open
        onToggle={onToggle}
        onClose={() => {}}
        label="Width"
        popLabel="Width"
        button={<span>4</span>}
      >
        <span data-testid="shell-body">body</span>
      </DropdownShell>,
    );
    expect(screen.getByRole('dialog', { name: 'Width' })).not.toBeNull();
    expect(screen.getByTestId('shell-body')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Width' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
