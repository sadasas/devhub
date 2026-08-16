import { useState, type KeyboardEvent } from 'react';
import type { WhiteboardShape, WhiteboardElement } from '../../lib/types';
import { ColorPalette } from './ColorPalette';

interface WhiteboardPopoverProps {
  el: WhiteboardElement;
  onPatch: (patch: Record<string, unknown>) => void;
  onDone: () => void;
  onCancel: () => void;
}

export function WhiteboardPopover({ el, onPatch, onDone, onCancel }: WhiteboardPopoverProps) {
  const isShape = el.kind === 'shape';
  const isText = el.kind === 'text';
  const [label, setLabel] = useState(isShape ? (el as WhiteboardShape).label : '');
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

  const commitText = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
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
          <div className="fp-segmented" role="radiogroup" aria-label="Shape type">
            {(['rect', 'diamond', 'ellipse'] as const).map((st) => (
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
                onKeyDown={commitText}
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