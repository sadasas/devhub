/**
 * Reserved keyboard shortcuts for the whiteboard canvas.
 *
 * Contract (FigJam parity, audited 2026):
 * - Tools are single letters (V/H/M/P/E/T/N/S/L/D/B); digits are never
 *   tool shortcuts, so project tab keys (1-4, Alt+digits) never collide.
 * - Space (hold) pans — never stolen from focused buttons/menus/dialogs.
 * - Delete/Backspace delete; arrows nudge 1px (Shift: 10px).
 * - Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo/redo (shell owns these).
 * - Ctrl+C/V/X copy/paste/cut; Ctrl+D duplicate; Ctrl+Shift+V paste to
 *   replace (Ctrl+Shift+R kept as legacy alias).
 * - Ctrl+G group / Ctrl+Shift+G ungroup; Ctrl+]/[ reorder (+Shift: edges).
 * - Ctrl+=/-/0 zoom in/out/reset; Ctrl+B toggles bold on text selection.
 * - Enter edits selected text / places with a tool; Esc tiered exit.
 * - Every handler must early-return when the event target is an
 *   INPUT/TEXTAREA/contentEditable element.
 */
export const SHORTCUTS = {
  view: 'h',
  select: 'v',
  pen: 'p',
  eraser: 'e',
  text: 't',
  sticky: 'n',
  shape: 's',
  edge: 'l',
  ref: 'd',
  marquee: 'm',
  boundary: 'b',
  pan: 'Space',
  delete: 'Delete',
  deleteAlt: 'Backspace',
  undo: 'Mod+Z',
  redo: 'Mod+Y',
  redoAlt: 'Mod+Shift+Z',
  copy: 'Mod+C',
  cut: 'Mod+X',
  paste: 'Mod+V',
  pasteReplace: 'Mod+Shift+V',
  pasteReplaceAlt: 'Mod+Shift+R',
  duplicate: 'Mod+D',
  group: 'Mod+G',
  ungroup: 'Mod+Shift+G',
  bringForward: 'Mod+]',
  sendBackward: 'Mod+[',
  bringFront: 'Mod+Shift+]',
  sendBack: 'Mod+Shift+[',
  bold: 'Mod+B',
  zoomIn: 'Mod+=',
  zoomOut: 'Mod+-',
  zoomReset: 'Mod+0',
  nudge: 'Arrows',
  nudgeBig: 'Shift+Arrows',
  editText: 'Enter',
  help: '?',
  escape: 'Esc',
} as const;