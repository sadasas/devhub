import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { WhiteboardBoundary, WhiteboardEdge, WhiteboardShape, WhiteboardSticky, WhiteboardElement } from '../../lib/types';
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

function editLabelKey(kind: WhiteboardElement['kind']): string {
  switch (kind) {
    case 'shape':
      return 'whiteboard.popover.editShape';
    case 'sticky':
      return 'whiteboard.popover.editSticky';
    case 'edge':
      return 'whiteboard.popover.editEdge';
    case 'boundary':
      return 'whiteboard.popover.editBoundary';
    default:
      return 'whiteboard.popover.editText';
  }
}

export function WhiteboardPopover({ el, onPatch, onDone, onCancel }: WhiteboardPopoverProps) {
  const { t } = useTranslation('extras');
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
    <div className="wb-popover" role="dialog" aria-label={t(editLabelKey(el.kind))} onKeyDown={cancelKey}>
      {isShape ? (
        <>
          <div className="fp-segmented fp-segmented-wrap" role="radiogroup" aria-label={t('whiteboard.popover.shapeType')}>
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
            <span className="field-label">{t('whiteboard.popover.label')}</span>
            <input
              className="input"
              value={label}
              maxLength={200}
              placeholder={t('whiteboard.popover.placeholderDecide')}
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
            {t('whiteboard.popover.filled')}
          </label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.rotationGroup')}>
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
            <span className="field-label">{t('whiteboard.popover.rotation')}</span>
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
          <ColorPalette value={el.color} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.shapeColor')} />
          <label className="field" style={{ marginTop: 8 }}>
            <span className="field-label">{t('whiteboard.popover.textColor')}</span>
            <ColorPalette value={(el as WhiteboardShape).labelColor ?? el.color} onChange={(c) => onPatch({ labelColor: c })} label={t('whiteboard.popover.textColor')} />
          </label>
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label={t('whiteboard.popover.cancelChanges')}>
              {t('whiteboard.popover.cancel')}
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label={t('whiteboard.popover.finishEditing')}>
              {t('whiteboard.popover.done')}
            </button>
          </div>
        </>
      ) : el.kind === 'boundary' ? (
        <>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.label')}</span>
            <input
              className="input"
              value={(el as WhiteboardBoundary).label}
              maxLength={200}
              placeholder={t('whiteboard.popover.placeholderSystem')}
              onChange={(e) => onPatch({ label: e.target.value })}
              onKeyDown={commitText}
            />
          </label>
          <ColorPalette value={el.color} onChange={(color) => onPatch({ color })} />
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label={t('whiteboard.popover.cancelChanges')}>
              {t('whiteboard.popover.cancel')}
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label={t('whiteboard.popover.finishEditing')}>
              {t('whiteboard.popover.done')}
            </button>
          </div>
        </>
      ) : el.kind === 'edge' ? (
        <>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.label')}</span>
            <input
              className="input"
              value={(el as WhiteboardEdge).label}
              maxLength={200}
              placeholder={t('whiteboard.popover.placeholderYes')}
              onChange={(e) => onPatch({ label: e.target.value })}
              onKeyDown={commitText}
            />
          </label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.arrowStyle')}>
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
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.lineStyle')}>
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
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label={t('whiteboard.popover.cancelChanges')}>
              {t('whiteboard.popover.cancel')}
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label={t('whiteboard.popover.finishEditing')}>
              {t('whiteboard.popover.done')}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{isText ? t('whiteboard.popover.textLabel') : t('whiteboard.popover.stickyTextLabel')}</span>
            {isText ? (
              <textarea
                className="textarea"
                rows={2}
                maxLength={1000}
                placeholder={t('whiteboard.popover.typePlaceholder')}
                value={textValue()}
                onChange={(e) => onPatch({ text: e.target.value })}
                onKeyDown={(e) => commitText(e, true)}
              />
            ) : (
              <input
                className="input"
                maxLength={500}
                placeholder={t('whiteboard.popover.typePlaceholder')}
                value={textValue()}
                onChange={(e) => onPatch({ text: e.target.value })}
                onKeyDown={commitText}
              />
            )}
            {isText && <span className="fp-hint">{t('whiteboard.popover.enterHint')}</span>}
          </label>
          {isText ? (
            <ColorPalette value={elColor()} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.textColor')} />
          ) : (
            <>
              <label className="field" style={{ marginTop: 8 }}>
                <span className="field-label">{t('whiteboard.popover.background')}</span>
                <ColorPalette value={elColor()} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.background')} />
              </label>
              <label className="field" style={{ marginTop: 8 }}>
                <span className="field-label">{t('whiteboard.popover.textColor')}</span>
                <ColorPalette value={(el as WhiteboardSticky).textColor ?? 'rgba(6,5,4,0.85)'} onChange={(c) => onPatch({ textColor: c })} label={t('whiteboard.popover.textColor')} />
              </label>
            </>
          )}
          <div className="fp-actions">
            <button type="button" className="fp-btn fp-btn-ghost" onClick={onCancel} aria-label={t('whiteboard.popover.cancelChanges')}>
              {t('whiteboard.popover.cancel')}
            </button>
            <button type="button" className="fp-btn fp-btn-primary" onClick={onDone} aria-label={t('whiteboard.popover.finishEditing')}>
              {t('whiteboard.popover.done')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}