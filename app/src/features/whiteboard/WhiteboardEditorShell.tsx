import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowLeft, BoundingBox, Cards, Cursor, Eraser, FlowArrow, Note, PenNib, TextT } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import type { Whiteboard } from '../../lib/types';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { SHORTCUTS, isModalOrPaletteOpen, isTypingTarget } from './shortcuts';
import type { WbTool } from './tools';
import { useWhiteboardHistory } from './useWhiteboardHistory';

interface WhiteboardEditorShellProps {
  board: Whiteboard;
  onBack: () => void;
}

const TOOLS = [
  { id: 'select', name: 'Select', icon: Cursor, shortcut: SHORTCUTS.select },
  { id: 'pen', name: 'Pen', icon: PenNib, shortcut: SHORTCUTS.pen },
  { id: 'eraser', name: 'Eraser', icon: Eraser, shortcut: SHORTCUTS.eraser },
  { id: 'text', name: 'Text', icon: TextT, shortcut: SHORTCUTS.text },
  { id: 'sticky', name: 'Sticky note', icon: Note, shortcut: SHORTCUTS.sticky },
  { id: 'shape', name: 'Shape', icon: BoundingBox, shortcut: SHORTCUTS.shape },
  { id: 'edge', name: 'Edge', icon: FlowArrow, shortcut: SHORTCUTS.edge },
  { id: 'ref', name: 'Entity ref card', icon: Cards, shortcut: SHORTCUTS.ref },
] as const;

const ACTIVE_TOOLS: ReadonlySet<string> = new Set(['select', 'pen', 'eraser', 'text', 'sticky', 'shape', 'edge', 'ref']);

export function WhiteboardEditorShell({ board, onBack }: WhiteboardEditorShellProps) {
  const [tool, setTool] = useState<WbTool>('select');
  const history = useWhiteboardHistory(board.id, board.elements);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      const key = e.key;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        historyRef.current.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        historyRef.current.redo();
        return;
      }
      if (mod && key === 'z' && e.shiftKey) {
        e.preventDefault();
        historyRef.current.redo();
        return;
      }
      if (key === SHORTCUTS.select && ACTIVE_TOOLS.has('select')) {
        setTool('select');
      } else if (key === SHORTCUTS.pen && ACTIVE_TOOLS.has('pen')) {
        setTool('pen');
      } else if (key === SHORTCUTS.eraser && ACTIVE_TOOLS.has('eraser')) {
        setTool('eraser');
      } else if (key === SHORTCUTS.text && ACTIVE_TOOLS.has('text')) {
        setTool('text');
      } else if (key === SHORTCUTS.sticky && ACTIVE_TOOLS.has('sticky')) {
        setTool('sticky');
      } else if (key === SHORTCUTS.shape && ACTIVE_TOOLS.has('shape')) {
        setTool('shape');
      } else if (key === SHORTCUTS.edge && ACTIVE_TOOLS.has('edge')) {
        setTool('edge');
      } else if (key === SHORTCUTS.ref && ACTIVE_TOOLS.has('ref')) {
        setTool('ref');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="wb-shell">
      <div className="board-toolbar">
        <Button variant="ghost" size="sm" className="back-btn" onClick={onBack} aria-label="Back to boards">
          <ArrowLeft size={14} aria-hidden="true" />
        </Button>
        <div className="sub-tabs" role="toolbar" aria-label="Whiteboard tools">
          {TOOLS.map((item) => {
            const active = ACTIVE_TOOLS.has(item.id) && tool === item.id;
            return (
              <button
                key={item.name}
                type="button"
                className={`sub-tab${active ? ' sub-tab-active' : ''}`}
                disabled={!ACTIVE_TOOLS.has(item.id)}
                title={item.name}
                aria-label={`${item.name} — ${item.shortcut}`}
                aria-pressed={active}
                onClick={() => {
                  if (ACTIVE_TOOLS.has(item.id)) setTool(item.id as WbTool);
                }}
              >
                <item.icon size={15} aria-hidden="true" />
              </button>
            );
          })}
          <span className="wb-sep" aria-hidden="true" />
          <button
            type="button"
            className="sub-tab"
            disabled={!history.canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo — Ctrl+Z"
            onClick={history.undo}
          >
            <ArrowCounterClockwise size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sub-tab"
            disabled={!history.canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo — Ctrl+Y"
            onClick={history.redo}
          >
            <ArrowClockwise size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <WhiteboardCanvas board={board} tool={tool} history={history} />
    </div>
  );
}