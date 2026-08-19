/**
 * Reserved keyboard shortcuts for the whiteboard canvas (M17).
 *
 * Contract for the future canvas task:
 * - `1`–`8` select tools; Space (hold) pans; Delete/Backspace delete the
 *   selection; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo/redo.
 * - Esc cancels the active tool / deselects, but only when no modal or the
 *   command palette is open (both own the Esc key globally).
 * - Every handler must early-return when the event target is an
 *   INPUT/TEXTAREA/contentEditable element.
 */
export const SHORTCUTS = {
  select: '1',
  pen: '2',
  eraser: '3',
  text: '4',
  sticky: '5',
  shape: '6',
  edge: '7',
  ref: '8',
  marquee: '9',
  boundary: 'b',
  pan: 'Space',
  delete: 'Delete',
  deleteAlt: 'Backspace',
  undo: 'Mod+Z',
  redo: 'Mod+Y',
  redoAlt: 'Mod+Shift+Z',
  escape: 'Esc',
} as const;