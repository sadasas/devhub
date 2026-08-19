import { useState, type KeyboardEvent } from 'react';
import type { WhiteboardBoundary, WhiteboardEdge, WhiteboardShape, WhiteboardElement } from '../../lib/types';
import { effectiveArrowStyle } from './edges';
import { ColorPalette } from './ColorPalette';

interface WhiteboardPopoverProps {
  el: WhiteboardElement;
  onPatch: (patch: Record<string, unknown>) => void;
  onDone: () => void;
  onCancel: () => void;
}

const SHAPE_TYPES = ['rect', 'diamond', 'ellipse', 'cylinder', 'parallelogram', 'hexagon', 'roundedRect'] as const;

const ARROW_STYLES = ['none', 'open', 'solid', 'diamond', 'circle'] as const;

const DASH_STYLES = ['solid', 'dashed', 'dotted'] as const;

export function WhiteboardPopover({ el, onPatch, onDone, onCancel }: WhiteboardPopoverProps) {
  const isShape = el.kind === 'shape';
  const isText = el.kind === 'text';
  const [label, setLabel] = useState(el.kind === 'shape' ? (el as WhiteboardShape).label : '');
  const [fill, setFill] = useState(isShape ? (el as WhiteboardShape).fill : false);

  const textValue = () => {
    if (el.kind === 'sticky' || el.kind === 'text') return el.text;
    return '';
  };

  const elColor = (): string => {
    switch (el.kind) {
      case 'shape':
      case 'text':
      case 'sticky':
        return el.color;
      default:
        return '#e4e4e7';
    }
  };

  const commitText = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, shiftInsertsNewline = false) => {
    if (e.key !== 'Enter') return;
    if (shiftInsertsNewline && e.shiftKey) return;
    e.preventDefault();
    onDone();
  };

  const cancelKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="wb-popover" role="dialog" aria-label={`Edit ${el.kind}`} onKeyDown={cancelKey}>
      {isShape ? (
        <>
          <div className="fp-segmented fp-segmented-wrap" role="radiogroup" aria-label="Shape type">
            {SHAPE_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={(el as WhiteboardShape).shapeType === st}
                className={`fp-seg${(el as WhiteboardShape).shapeType === st ? ' fp-seg-active' : ''}`}
                onClick={() => onPatch({ shapeType: st })}
              >
                {st}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Label</span>
            <input
              className="input"
              value={label}
              maxLength={200}
              placeholder="e.g. Decide"
              onChange={(e) => {
                setLabel(e.target.value);
                onPatch({ label: e.target.value });
              }}
              onKeyDown={commitText}
            />
          </label>
          <label className="fp-check">
            <input
              type="checkbox"
              checked={fill}
              onChange={(e) => {
                setFill(e.target.checked);
                onPatch({ fill: e.target.checked });
              }}
            />
            Filled
          </label>
          <div className="fp-segmented" role="radiogroup" aria-label="Rotation">
            {[0, 90, 180, 270].map((deg) => (
              <button
                key={deg}
                type="button"
                role="radio"
                aria-checked={((el as WhiteboardShape).rotation ?? 0) % 360 === deg}
                className={`fp-seg${((el as WhiteboardShape).rotation ?? 0) % 360 === deg ? ' fp-seg-active' : ''}`}
                onClick={() => onPatch({ rotation: deg })}
              >
                {deg}°
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Rotation°</span>
            <input
              className="input"
              type="number"
              min={-360}
              max={360}
              step={1}
              value={(el as WhiteboardShape).rotation ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) onPatch({ rotation: Math.max(-360, Math.min(360, v)) });
              }}
            />
          </label>
          <ColorPalette value={el.color} onChange={(color) => onPatch({ color })} />
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label="Cancel changes">
              Cancel
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label="Finish editing">
              Done
            </button>
          </div>
        </>
      ) : el.kind === 'boundary' ? (
        <>
          <label className="field">
            <span className="field-label">Label</span>
            <input
              className="input"
              value={(el as WhiteboardBoundary).label}
              maxLength={200}
              placeholder="e.g. System"
              onChange={(e) => onPatch({ label: e.target.value })}
              onKeyDown={commitText}
            />
          </label>
          <ColorPalette value={el.color} onChange={(color) => onPatch({ color })} />
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label="Cancel changes">
              Cancel
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label="Finish editing">
              Done
            </button>
          </div>
        </>
      ) : el.kind === 'edge' ? (
        <>
          <label className="field">
            <span className="field-label">Label</span>
            <input
              className="input"
              value={(el as WhiteboardEdge).label}
              maxLength={200}
              placeholder="e.g. Yes / HTTP"
              onChange={(e) => onPatch({ label: e.target.value })}
              onKeyDown={commitText}
            />
          </label>
          <div className="fp-segmented" role="radiogroup" aria-label="Arrow style">
            {ARROW_STYLES.map((st) => (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={effectiveArrowStyle(el as WhiteboardEdge) === st}
                className={`fp-seg${effectiveArrowStyle(el as WhiteboardEdge) === st ? ' fp-seg-active' : ''}`}
                onClick={() => onPatch({ arrowStyle: st })}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="fp-segmented" role="radiogroup" aria-label="Line style">
            {DASH_STYLES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={((el as WhiteboardEdge).dash ?? 'solid') === d}
                className={`fp-seg${((el as WhiteboardEdge).dash ?? 'solid') === d ? ' fp-seg-active' : ''}`}
                onClick={() => onPatch({ dash: d })}
              >
                {d}
              </button>
            ))}
          </div>
          <ColorPalette value={el.color} onChange={(color) => onPatch({ color })} />
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label="Cancel changes">
              Cancel
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label="Finish editing">
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{isText ? 'Text' : 'Sticky text'}</span>
            {isText ? (
              <textarea
                className="textarea"
                rows={2}
                maxLength={1000}
                placeholder="Type…"
                value={textValue()}
                onChange={(e) => onPatch({ text: e.target.value })}
                onKeyDown={(e) => commitText(e, true)}
              />
            ) : (
              <input
                className="input"
                maxLength={500}
                placeholder="Type…"
                value={textValue()}
                onChange={(e) => onPatch({ text: e.target.value })}
                onKeyDown={commitText}
              />
            )}
            {isText && <span className="fp-hint">Enter to finish · Shift+Enter newline</span>}
          </label>
          <ColorPalette value={elColor()} onChange={(color) => onPatch({ color })} />
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label="Cancel changes">
              Cancel
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label="Finish editing">
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}