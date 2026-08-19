import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, ArrowLeft, ArrowsInSimple, ArrowsOutSimple, BoundingBox, Cards, Cursor, Eraser, Export, FlowArrow, FrameCorners, HandPointing, Note, PenNib, Selection, TextT } from '@phosphor-icons/react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import type { State, Whiteboard } from '../../lib/types';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { SHORTCUTS } from './shortcuts';
import { isModalOrPaletteOpen, isTypingTarget } from '../../lib/keys';
import type { WbTool } from './tools';
import { useWhiteboardHistory } from './useWhiteboardHistory';
import { buildRefDataMap } from './ref-data';
import { downloadWhiteboardPdf, downloadWhiteboardPng, downloadWhiteboardSvg } from './export';

interface WhiteboardEditorShellProps {
  board: Whiteboard;
  state: State;
  onBack: () => void;
}

const WARN_ELEMENTS = 800;
const MAX_ELEMENTS = 1000;
const ADD_TOOLS: ReadonlySet<string> = new Set(['pen', 'text', 'sticky', 'shape', 'edge', 'ref', 'boundary']);

const TOOLS = [
  { id: 'view', name: 'View only', icon: HandPointing, shortcut: SHORTCUTS.view },
  { id: 'select', name: 'Select', icon: Cursor, shortcut: SHORTCUTS.select },
  { id: 'marquee', name: 'Select area', icon: Selection, shortcut: SHORTCUTS.marquee },
  { id: 'pen', name: 'Pen', icon: PenNib, shortcut: SHORTCUTS.pen },
  { id: 'eraser', name: 'Eraser', icon: Eraser, shortcut: SHORTCUTS.eraser },
  { id: 'text', name: 'Text', icon: TextT, shortcut: SHORTCUTS.text },
  { id: 'sticky', name: 'Sticky note', icon: Note, shortcut: SHORTCUTS.sticky },
  { id: 'shape', name: 'Shape', icon: BoundingBox, shortcut: SHORTCUTS.shape },
  { id: 'edge', name: 'Edge', icon: FlowArrow, shortcut: SHORTCUTS.edge },
  { id: 'ref', name: 'Entity ref card', icon: Cards, shortcut: SHORTCUTS.ref },
  { id: 'boundary', name: 'Boundary', icon: FrameCorners, shortcut: SHORTCUTS.boundary },
] as const;

const ACTIVE_TOOLS: ReadonlySet<string> = new Set(['view', 'select', 'marquee', 'pen', 'eraser', 'text', 'sticky', 'shape', 'edge', 'ref', 'boundary']);

export function WhiteboardEditorShell({ board, state, onBack }: WhiteboardEditorShellProps) {
  const [tool, setTool] = useState<WbTool>('select');
  const history = useWhiteboardHistory(board.id, board.elements);
  const historyRef = useRef(history);
  historyRef.current = history;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const refDataMap = useMemo(() => buildRefDataMap(board.elements, state), [board.elements, state]);
  const elementCount = board.elements.length;
  const nearCap = elementCount >= WARN_ELEMENTS;
  const atCap = elementCount >= MAX_ELEMENTS;

  useEffect(() => {
    if (!exportOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void shellRef.current?.requestFullscreen();
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      if (e.altKey) return;
      const key = e.key;
      const mod = e.ctrlKey || e.metaKey;
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
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
      if (key === SHORTCUTS.view && ACTIVE_TOOLS.has('view')) {
        setTool('view');
      } else if (key === SHORTCUTS.select && ACTIVE_TOOLS.has('select')) {
        setTool('select');
      } else if (key === SHORTCUTS.marquee && ACTIVE_TOOLS.has('marquee')) {
        setTool('marquee');
      } else if (!atCap && key === SHORTCUTS.pen && ACTIVE_TOOLS.has('pen')) {
        setTool('pen');
      } else if (key === SHORTCUTS.eraser && ACTIVE_TOOLS.has('eraser')) {
        setTool('eraser');
      } else if (!atCap && key === SHORTCUTS.text && ACTIVE_TOOLS.has('text')) {
        setTool('text');
      } else if (!atCap && key === SHORTCUTS.sticky && ACTIVE_TOOLS.has('sticky')) {
        setTool('sticky');
      } else if (!atCap && key === SHORTCUTS.shape && ACTIVE_TOOLS.has('shape')) {
        setTool('shape');
      } else if (!atCap && key === SHORTCUTS.edge && ACTIVE_TOOLS.has('edge')) {
        setTool('edge');
      } else if (!atCap && key === SHORTCUTS.ref && ACTIVE_TOOLS.has('ref')) {
        setTool('ref');
      } else if (!atCap && key === SHORTCUTS.boundary && ACTIVE_TOOLS.has('boundary')) {
        setTool('boundary');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [atCap]);

  return (
    <div className="wb-shell" ref={shellRef}>
      <div className="board-toolbar">
        <Button variant="ghost" size="sm" className="back-btn" onClick={onBack} aria-label="Back to boards">
          <ArrowLeft size={14} aria-hidden="true" />
        </Button>
        <div className="sub-tabs" role="toolbar" aria-label="Whiteboard tools">
          {TOOLS.map((item) => {
            const active = ACTIVE_TOOLS.has(item.id) && tool === item.id;
            const blocked = atCap && ADD_TOOLS.has(item.id);
            return (
              <button
                key={item.name}
                type="button"
                className={`sub-tab${active ? ' sub-tab-active' : ''}`}
                disabled={!ACTIVE_TOOLS.has(item.id) || blocked}
                title={blocked ? `${item.name} — element limit reached` : item.name}
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
          <span className="wb-sep" aria-hidden="true" />
          <button
            type="button"
            className="sub-tab"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            aria-label={isFullscreen ? 'Exit fullscreen — F' : 'Fullscreen — F'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <ArrowsInSimple size={15} aria-hidden="true" />
            ) : (
              <ArrowsOutSimple size={15} aria-hidden="true" />
            )}
          </button>
          <span className="wb-export-wrap">
            <button
              type="button"
              className="sub-tab"
              disabled={elementCount === 0}
              title={elementCount === 0 ? 'Export — the board is empty' : 'Export PNG/SVG'}
              aria-label="Export diagram"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
            >
              <Export size={15} aria-hidden="true" />
            </button>
            {exportOpen && (
              <div ref={exportMenuRef} className="wb-export-menu" role="menu" aria-label="Export diagram">
                <button
                  type="button"
                  role="menuitem"
                  className="wb-export-item"
                  onClick={() => {
                    setExportOpen(false);
                    downloadWhiteboardPng(board, refDataMap);
                  }}
                >
                  PNG image
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="wb-export-item"
                  onClick={() => {
                    setExportOpen(false);
                    downloadWhiteboardSvg(board, refDataMap);
                  }}
                >
                  SVG image
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="wb-export-item"
                  onClick={() => {
                    setExportOpen(false);
                    downloadWhiteboardPdf(board, refDataMap);
                  }}
                >
                  PDF document
                </button>
              </div>
            )}
          </span>
        </div>
        {nearCap && (
          <div className={`wb-cap-banner${atCap ? ' wb-cap-banner-danger' : ''}`} role="alert">
            <Badge tone={atCap ? 'danger' : 'warn'}>{elementCount}/1000 elements</Badge>
            <span>
              {atCap
                ? 'Element limit reached — delete elements to add more.'
                : 'Approaching the element limit — delete elements to keep editing.'}
            </span>
          </div>
        )}
      </div>

      <WhiteboardCanvas board={board} tool={tool} history={history} />
    </div>
  );
}