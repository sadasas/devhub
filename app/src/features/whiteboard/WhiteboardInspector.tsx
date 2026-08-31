import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { WhiteboardBoundary, WhiteboardEdge, WhiteboardShape, WhiteboardShapeType, WhiteboardArrowStyle, WhiteboardSticky, WhiteboardText, WhiteboardElement, WhiteboardAlign } from '../../lib/types';
import { effectiveArrowStyle } from './edges';
import { ColorPalette } from './ColorPalette';

interface WhiteboardInspectorProps {
  element: WhiteboardElement | null;
  selectedCount: number;
  onPatch: (patch: Record<string, unknown>) => void;
  onDone?: () => void;
  onCancel?: () => void;
  onCollapse?: () => void;
  tool?: string;
  penColor?: string;
  penWidth?: number;
  onPenColorChange?: (c: string) => void;
  onPenWidthChange?: (w: number) => void;
  eraserWidth?: number;
  onEraserWidthChange?: (w: number) => void;
  stickyColor?: string;
  stickyTextColor?: string;
  stickyFontSize?: number;
  stickyAlign?: WhiteboardAlign | null;
  onStickyColorChange?: (c: string) => void;
  onStickyTextColorChange?: (c: string) => void;
  onStickyFontSizeChange?: (v: number) => void;
  onStickyAlignChange?: (a: WhiteboardAlign) => void;
  textColor?: string;
  textFontSize?: number;
  textAlign?: WhiteboardAlign | null;
  onTextColorChange?: (c: string) => void;
  onTextFontSizeChange?: (v: number) => void;
  onTextAlignChange?: (a: WhiteboardAlign) => void;
  shapeColor?: string;
  shapeLabelColor?: string;
  shapeFontSize?: number;
  shapeAlign?: WhiteboardAlign | null;
  shapeType?: WhiteboardShapeType | null;
  shapeLabel?: string;
  shapeFill?: boolean;
  shapeRotation?: number;
  onShapeColorChange?: (c: string) => void;
  onShapeLabelColorChange?: (c: string) => void;
  onShapeFontSizeChange?: (v: number) => void;
  onShapeAlignChange?: (a: WhiteboardAlign) => void;
  onShapeTypeChange?: (v: WhiteboardShapeType) => void;
  onShapeLabelChange?: (v: string) => void;
  onShapeFillChange?: (v: boolean) => void;
  onShapeRotationChange?: (v: number) => void;
  edgeColor?: string;
  edgeFontSize?: number;
  edgeAlign?: WhiteboardAlign | null;
  edgeLabel?: string;
  edgeArrowStyle?: WhiteboardArrowStyle | null;
  edgeDash?: WhiteboardEdge['dash'] | null;
  onEdgeColorChange?: (c: string) => void;
  onEdgeFontSizeChange?: (v: number) => void;
  onEdgeAlignChange?: (a: WhiteboardAlign) => void;
  onEdgeLabelChange?: (v: string) => void;
  onEdgeArrowStyleChange?: (v: WhiteboardArrowStyle) => void;
  onEdgeDashChange?: (v: NonNullable<WhiteboardEdge['dash']>) => void;
  boundaryColor?: string;
  boundaryLabelColor?: string;
  boundaryFontSize?: number;
  boundaryAlign?: WhiteboardAlign | null;
  boundaryLabel?: string;
  onBoundaryColorChange?: (c: string) => void;
  onBoundaryLabelColorChange?: (c: string) => void;
  onBoundaryFontSizeChange?: (v: number) => void;
  onBoundaryAlignChange?: (a: WhiteboardAlign) => void;
  onBoundaryLabelChange?: (v: string) => void;
  refTitle?: string | null;
  refMeta?: string | null;
}

const SHAPE_TYPES = ['rect', 'diamond', 'ellipse', 'cylinder', 'parallelogram', 'hexagon', 'roundedRect'] as const;
const ARROW_STYLES = ['none', 'open', 'solid', 'diamond', 'circle'] as const;
const DASH_STYLES = ['solid', 'dashed', 'dotted'] as const;
const ALIGN_OPTIONS = ['left', 'center', 'right'] as const;

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

export function WhiteboardInspector({ element, selectedCount, onPatch, tool, penColor, penWidth, onPenColorChange, onPenWidthChange, eraserWidth, onEraserWidthChange, stickyColor, stickyTextColor, stickyFontSize, stickyAlign, onStickyColorChange, onStickyTextColorChange, onStickyFontSizeChange, onStickyAlignChange, textColor, textFontSize, textAlign, onTextColorChange, onTextFontSizeChange, onTextAlignChange, shapeColor, shapeLabelColor, shapeFontSize, shapeAlign, shapeType, shapeLabel, shapeFill, shapeRotation, onShapeColorChange, onShapeLabelColorChange, onShapeFontSizeChange, onShapeAlignChange, onShapeTypeChange, onShapeLabelChange, onShapeFillChange, onShapeRotationChange, edgeColor, edgeFontSize, edgeAlign, edgeLabel, edgeArrowStyle, edgeDash, onEdgeColorChange, onEdgeFontSizeChange, onEdgeAlignChange, onEdgeLabelChange, onEdgeArrowStyleChange, onEdgeDashChange, boundaryColor, boundaryLabelColor, boundaryFontSize, boundaryAlign, boundaryLabel, onBoundaryColorChange, onBoundaryLabelColorChange, onBoundaryFontSizeChange, onBoundaryAlignChange, onBoundaryLabelChange, refTitle, refMeta }: WhiteboardInspectorProps) {
  const { t } = useTranslation('extras');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const [label, setLabel] = useState(element?.kind === 'shape' ? (element as WhiteboardShape).label : '');
  const [fill, setFill] = useState(element?.kind === 'shape' ? (element as WhiteboardShape).fill : false);

  useEffect(() => {
    if (element?.kind === 'shape') {
      setLabel((element as WhiteboardShape).label);
      setFill((element as WhiteboardShape).fill);
    }
  }, [element?.id, (element as WhiteboardShape)?.label, (element as WhiteboardShape)?.fill]);

  useEffect(() => {
    if (element) {
      requestAnimationFrame(() => firstInputRef.current?.focus());
    }
  }, [element?.id]);

  // Pen tool props when no element selected and tool is pen (B logic)
  if (!element) {
    if (tool === 'pen' && penColor !== undefined && onPenColorChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.pen')}>
          <div className="wb-inspector-head">
            <span className="wb-inspector-title">{t('whiteboard.tool.pen')}</span>
          </div>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.textColor')}</span>
            <ColorPalette value={penColor} onChange={onPenColorChange} label={t('whiteboard.popover.textColor')} />
          </label>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.lineWidth', { defaultValue: 'Width' })}</span>
            <div className="wb-font-slider">
              <input type="range" min={1} max={8} step={1} value={penWidth ?? 2} onChange={(e) => onPenWidthChange?.(Number(e.target.value))} aria-label={t('whiteboard.popover.lineWidth', { defaultValue: 'Width' })} />
              <input type="number" className="input wb-font-input" min={1} max={20} step={1} value={penWidth ?? 2} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onPenWidthChange?.(Math.max(1, Math.min(20, v))); }} />
            </div>
          </label>
        </div>
      );
    }
    if (tool === 'eraser' && eraserWidth !== undefined && onEraserWidthChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.eraser')}>
          <div className="wb-inspector-head">
            <span className="wb-inspector-title">{t('whiteboard.tool.eraser')}</span>
          </div>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.lineWidth', { defaultValue: 'Size' })}</span>
            <div className="wb-font-slider">
              <input type="range" min={4} max={20} step={1} value={eraserWidth} onChange={(e) => onEraserWidthChange(Number(e.target.value))} aria-label={t('whiteboard.popover.lineWidth', { defaultValue: 'Size' })} />
              <input type="number" className="input wb-font-input" min={4} max={20} step={1} value={eraserWidth} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onEraserWidthChange(Math.max(4, Math.min(20, v))); }} />
            </div>
          </label>
        </div>
      );
    }
    if (tool === 'sticky' && stickyColor !== undefined && onStickyColorChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.sticky')}>
          <div className="wb-inspector-head"><span className="wb-inspector-title">{t('whiteboard.tool.sticky')}</span></div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.background')}</span><ColorPalette value={stickyColor!} onChange={onStickyColorChange!} label={t('whiteboard.popover.background')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.textColor')}</span><ColorPalette value={stickyTextColor ?? '#1a1a1a'} onChange={(c) => onStickyTextColorChange?.(c)} label={t('whiteboard.popover.textColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.fontSize')}</span><div className="wb-font-slider"><input type="range" min={4} max={48} step={1} value={Math.max(4, Math.min(72, stickyFontSize ?? 12))} onChange={(e) => onStickyFontSizeChange?.(Number(e.target.value))} aria-label={t('whiteboard.popover.fontSize')} /><input type="number" className="input wb-font-input" min={4} max={72} step={1} value={Math.max(4, Math.min(72, stickyFontSize ?? 12))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onStickyFontSizeChange?.(Math.max(4, Math.min(72, v))); }} /></div></label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.align')}>{(['left','center','right'] as const).map((a) => (<button key={a} type="button" role="radio" aria-checked={(stickyAlign ?? 'left') === a} className={`fp-seg${(stickyAlign ?? 'left') === a ? ' fp-seg-active' : ''}`} onClick={() => onStickyAlignChange?.(a)}>{t(`whiteboard.popover.align_${a}`)}</button>))}</div>
        </div>
      );
    }
    if (tool === 'text' && textColor !== undefined && onTextColorChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.text')}>
          <div className="wb-inspector-head"><span className="wb-inspector-title">{t('whiteboard.tool.text')}</span></div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.textColor')}</span><ColorPalette value={textColor!} onChange={onTextColorChange!} label={t('whiteboard.popover.textColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.fontSize')}</span><div className="wb-font-slider"><input type="range" min={4} max={48} step={1} value={Math.max(4, Math.min(72, textFontSize ?? 16))} onChange={(e) => onTextFontSizeChange?.(Number(e.target.value))} aria-label={t('whiteboard.popover.fontSize')} /><input type="number" className="input wb-font-input" min={4} max={72} step={1} value={Math.max(4, Math.min(72, textFontSize ?? 16))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onTextFontSizeChange?.(Math.max(4, Math.min(72, v))); }} /></div></label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.align')}>{(['left','center','right'] as const).map((a) => (<button key={a} type="button" role="radio" aria-checked={(textAlign ?? 'left') === a} className={`fp-seg${(textAlign ?? 'left') === a ? ' fp-seg-active' : ''}`} onClick={() => onTextAlignChange?.(a)}>{t(`whiteboard.popover.align_${a}`)}</button>))}</div>
        </div>
      );
    }
    if (tool === 'shape' && shapeColor !== undefined && onShapeColorChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.shape')}>
          <div className="wb-inspector-head"><span className="wb-inspector-title">{t('whiteboard.tool.shape')}</span></div>
          <div className="fp-segmented fp-segmented-wrap" role="radiogroup" aria-label={t('whiteboard.popover.shapeType')}>
            {SHAPE_TYPES.map((st) => (
              <button key={st} type="button" role="radio" aria-checked={(shapeType ?? 'rect') === st} className={`fp-seg${(shapeType ?? 'rect') === st ? ' fp-seg-active' : ''}`} onClick={() => onShapeTypeChange?.(st)}>{st}</button>
            ))}
          </div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.label')}</span><input className="input" value={shapeLabel ?? ''} maxLength={200} placeholder={t('whiteboard.popover.placeholderDecide')} onChange={(e) => onShapeLabelChange?.(e.target.value)} /></label>
          <label className="fp-check"><input type="checkbox" checked={shapeFill ?? false} onChange={(e) => onShapeFillChange?.(e.target.checked)} />{t('whiteboard.popover.filled')}</label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.rotationGroup')}>
            {[0, 90, 180, 270].map((deg) => (
              <button key={deg} type="button" role="radio" aria-checked={((shapeRotation ?? 0) % 360) === deg} className={`fp-seg${((shapeRotation ?? 0) % 360) === deg ? ' fp-seg-active' : ''}`} onClick={() => onShapeRotationChange?.(deg)}>{deg}°</button>
            ))}
          </div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.rotation')}</span><input className="input" type="number" min={-360} max={360} step={1} value={shapeRotation ?? 0} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onShapeRotationChange?.(Math.max(-360, Math.min(360, v))); }} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.shapeColor')}</span><ColorPalette value={shapeColor!} onChange={onShapeColorChange!} label={t('whiteboard.popover.shapeColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.textColor')}</span><ColorPalette value={shapeLabelColor ?? shapeColor!} onChange={(c) => onShapeLabelColorChange?.(c)} label={t('whiteboard.popover.textColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.fontSize')}</span><div className="wb-font-slider"><input type="range" min={4} max={48} step={1} value={Math.max(4, Math.min(72, shapeFontSize ?? 12))} onChange={(e) => onShapeFontSizeChange?.(Number(e.target.value))} aria-label={t('whiteboard.popover.fontSize')} /><input type="number" className="input wb-font-input" min={4} max={72} step={1} value={Math.max(4, Math.min(72, shapeFontSize ?? 12))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onShapeFontSizeChange?.(Math.max(4, Math.min(72, v))); }} /></div></label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.align')}>{(['left','center','right'] as const).map((a) => (<button key={a} type="button" role="radio" aria-checked={(shapeAlign ?? 'center') === a} className={`fp-seg${(shapeAlign ?? 'center') === a ? ' fp-seg-active' : ''}`} onClick={() => onShapeAlignChange?.(a)}>{t(`whiteboard.popover.align_${a}`)}</button>))}</div>
        </div>
      );
    }
    if (tool === 'edge' && edgeColor !== undefined && onEdgeColorChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.edge')}>
          <div className="wb-inspector-head"><span className="wb-inspector-title">{t('whiteboard.tool.edge')}</span></div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.label')}</span><input className="input" value={edgeLabel ?? ''} maxLength={200} placeholder={t('whiteboard.popover.placeholderYes')} onChange={(e) => onEdgeLabelChange?.(e.target.value)} /></label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.arrowStyle')}>
            {ARROW_STYLES.map((st) => (
              <button key={st} type="button" role="radio" aria-checked={(edgeArrowStyle ?? 'solid') === st} className={`fp-seg${(edgeArrowStyle ?? 'solid') === st ? ' fp-seg-active' : ''}`} onClick={() => onEdgeArrowStyleChange?.(st)}>{st}</button>
            ))}
          </div>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.lineStyle')}>
            {DASH_STYLES.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={(edgeDash ?? 'solid') === d} className={`fp-seg${(edgeDash ?? 'solid') === d ? ' fp-seg-active' : ''}`} onClick={() => onEdgeDashChange?.(d)}>{d}</button>
            ))}
          </div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.shapeColor')}</span><ColorPalette value={edgeColor!} onChange={onEdgeColorChange!} label={t('whiteboard.popover.shapeColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.fontSize')}</span><div className="wb-font-slider"><input type="range" min={4} max={48} step={1} value={Math.max(4, Math.min(72, edgeFontSize ?? 11))} onChange={(e) => onEdgeFontSizeChange?.(Number(e.target.value))} aria-label={t('whiteboard.popover.fontSize')} /><input type="number" className="input wb-font-input" min={4} max={72} step={1} value={Math.max(4, Math.min(72, edgeFontSize ?? 11))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onEdgeFontSizeChange?.(Math.max(4, Math.min(72, v))); }} /></div></label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.align')}>{(['left','center','right'] as const).map((a) => (<button key={a} type="button" role="radio" aria-checked={(edgeAlign ?? 'center') === a} className={`fp-seg${(edgeAlign ?? 'center') === a ? ' fp-seg-active' : ''}`} onClick={() => onEdgeAlignChange?.(a)}>{t(`whiteboard.popover.align_${a}`)}</button>))}</div>
        </div>
      );
    }
    if (tool === 'boundary' && boundaryColor !== undefined && onBoundaryColorChange) {
      return (
        <div className="wb-inspector" role="complementary" aria-label={t('whiteboard.tool.boundary')}>
          <div className="wb-inspector-head"><span className="wb-inspector-title">{t('whiteboard.tool.boundary')}</span></div>
          <label className="field"><span className="field-label">{t('whiteboard.popover.label')}</span><input className="input" value={boundaryLabel ?? ''} maxLength={200} placeholder={t('whiteboard.popover.placeholderSystem')} onChange={(e) => onBoundaryLabelChange?.(e.target.value)} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.shapeColor')}</span><ColorPalette value={boundaryColor!} onChange={onBoundaryColorChange!} label={t('whiteboard.popover.shapeColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.textColor')}</span><ColorPalette value={boundaryLabelColor ?? '#e4e4e7'} onChange={(c) => onBoundaryLabelColorChange?.(c)} label={t('whiteboard.popover.textColor')} /></label>
          <label className="field"><span className="field-label">{t('whiteboard.popover.fontSize')}</span><div className="wb-font-slider"><input type="range" min={4} max={48} step={1} value={Math.max(4, Math.min(72, boundaryFontSize ?? 12))} onChange={(e) => onBoundaryFontSizeChange?.(Number(e.target.value))} aria-label={t('whiteboard.popover.fontSize')} /><input type="number" className="input wb-font-input" min={4} max={72} step={1} value={Math.max(4, Math.min(72, boundaryFontSize ?? 12))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onBoundaryFontSizeChange?.(Math.max(4, Math.min(72, v))); }} /></div></label>
          <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.align')}>{(['left','center','right'] as const).map((a) => (<button key={a} type="button" role="radio" aria-checked={(boundaryAlign ?? 'left') === a} className={`fp-seg${(boundaryAlign ?? 'left') === a ? ' fp-seg-active' : ''}`} onClick={() => onBoundaryAlignChange?.(a)}>{t(`whiteboard.popover.align_${a}`)}</button>))}</div>
        </div>
      );
    }
    if (selectedCount > 1) {
      return (
        <div className="wb-inspector wb-inspector-empty" role="status">
          <p className="wb-inspector-empty-title">{t('whiteboard.inspector.multiTitle', { count: selectedCount })}</p>
          <p className="wb-inspector-empty-desc">{t('whiteboard.inspector.multiDesc')}</p>
        </div>
      );
    }
    return (
      <div className="wb-inspector wb-inspector-empty" role="status">
        <p className="wb-inspector-empty-title">{t('whiteboard.inspector.emptyTitle')}</p>
        <p className="wb-inspector-empty-desc">{t('whiteboard.inspector.emptyDesc')}</p>
      </div>
    );
  }

  // Ref card read-only
  if (element.kind === 'ref') {
    return (
      <div className="wb-inspector" role="complementary" aria-label="Reference">
        <div className="wb-inspector-head">
          <span className="wb-inspector-title">Reference</span>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{refTitle ?? element.entity}</p>
        {refMeta && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{refMeta}</p>}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{t('whiteboard.inspector.refReadOnly', { defaultValue: 'This card is read-only. Edit the source entity.' })}</p>
      </div>
    );
  }

  const isShape = element.kind === 'shape';
  const isText = element.kind === 'text';

  const textValue = () => {
    if (element.kind === 'sticky' || element.kind === 'text') return element.text;
    return '';
  };

  const elColor = (): string => {
    switch (element.kind) {
      case 'shape':
      case 'text':
      case 'sticky':
        return element.color;
      default:
        return '#e4e4e7';
    }
  };

  const commitText = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, shiftInsertsNewline = false) => {
    if (e.key !== 'Enter') return;
    if (shiftInsertsNewline && e.shiftKey) return;
    e.preventDefault();
  };

  const renderAlign = (value: string | null | undefined) => (
    <div className="fp-segmented" role="radiogroup" aria-label={t('whiteboard.popover.align')}>
      {ALIGN_OPTIONS.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={(value ?? (isShape ? 'center' : 'left')) === a}
          className={`fp-seg${(value ?? (isShape ? 'center' : 'left')) === a ? ' fp-seg-active' : ''}`}
          onClick={() => onPatch({ align: a })}
        >
          {t(`whiteboard.popover.align_${a}`)}
        </button>
      ))}
    </div>
  );

  const renderFontSize = (value: number | null | undefined, def: number) => {
    const clamped = Math.max(4, Math.min(72, value ?? def));
    return (
      <label className="field">
        <span className="field-label">{t('whiteboard.popover.fontSize')}</span>
        <div className="wb-font-slider">
          <input
            type="range"
            min={4}
            max={48}
            step={1}
            value={clamped}
            onChange={(e) => onPatch({ fontSize: Number(e.target.value) })}
            aria-label={t('whiteboard.popover.fontSize')}
          />
          <input
            type="number"
            className="input wb-font-input"
            min={4}
            max={72}
            step={1}
            value={clamped}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onPatch({ fontSize: Math.max(4, Math.min(72, v)) });
            }}
          />
        </div>
      </label>
    );
  };

  return (
    <div className="wb-inspector" role="complementary" aria-label={t(editLabelKey(element.kind))}>
      <div className="wb-inspector-head">
        <span className="wb-inspector-title">{t(editLabelKey(element.kind))}</span>
      </div>
      {isShape ? (
        <>
          <div className="fp-segmented fp-segmented-wrap" role="radiogroup" aria-label={t('whiteboard.popover.shapeType')}>
            {SHAPE_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={(element as WhiteboardShape).shapeType === st}
                className={`fp-seg${(element as WhiteboardShape).shapeType === st ? ' fp-seg-active' : ''}`}
                onClick={() => onPatch({ shapeType: st })}
              >
                {st}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.label')}</span>
            <input
              ref={firstInputRef}
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
                aria-checked={((element as WhiteboardShape).rotation ?? 0) % 360 === deg}
                className={`fp-seg${((element as WhiteboardShape).rotation ?? 0) % 360 === deg ? ' fp-seg-active' : ''}`}
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
              value={(element as WhiteboardShape).rotation ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) onPatch({ rotation: Math.max(-360, Math.min(360, v)) });
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.shapeColor')}</span>
            <ColorPalette value={element.color} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.shapeColor')} />
          </label>
          <label className="field" style={{ marginTop: 8 }}>
            <span className="field-label">{t('whiteboard.popover.textColor')}</span>
            <ColorPalette value={(element as WhiteboardShape).labelColor ?? element.color} onChange={(c) => onPatch({ labelColor: c })} label={t('whiteboard.popover.textColor')} />
          </label>
          {renderFontSize((element as WhiteboardShape).fontSize, 12)}
          {renderAlign((element as WhiteboardShape).align)}
        </>
      ) : element.kind === 'boundary' ? (
        <>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.label')}</span>
            <input
              ref={firstInputRef}
              className="input"
              value={(element as WhiteboardBoundary).label}
              maxLength={200}
              placeholder={t('whiteboard.popover.placeholderSystem')}
              onChange={(e) => onPatch({ label: e.target.value })}
              onKeyDown={commitText}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.shapeColor')}</span>
            <ColorPalette value={element.color} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.shapeColor')} />
          </label>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.textColor')}</span>
            <ColorPalette value={(element as WhiteboardBoundary & { labelColor?: string | null }).labelColor ?? '#e4e4e7'} onChange={(c) => onPatch({ labelColor: c })} label={t('whiteboard.popover.textColor')} />
          </label>
          {renderFontSize((element as WhiteboardBoundary).fontSize, 12)}
          {renderAlign((element as WhiteboardBoundary).align)}
        </>
      ) : element.kind === 'edge' ? (
        <>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.label')}</span>
            <input
              ref={firstInputRef}
              className="input"
              value={(element as WhiteboardEdge).label}
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
                aria-checked={effectiveArrowStyle(element as WhiteboardEdge) === st}
                className={`fp-seg${effectiveArrowStyle(element as WhiteboardEdge) === st ? ' fp-seg-active' : ''}`}
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
                aria-checked={((element as WhiteboardEdge).dash ?? 'solid') === d}
                className={`fp-seg${((element as WhiteboardEdge).dash ?? 'solid') === d ? ' fp-seg-active' : ''}`}
                onClick={() => onPatch({ dash: d })}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.shapeColor')}</span>
            <ColorPalette value={element.color} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.shapeColor')} />
          </label>
          {renderFontSize((element as WhiteboardEdge).fontSize, 11)}
          {renderAlign((element as WhiteboardEdge).align)}
        </>
      ) : element.kind === 'stroke' ? (
        <>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.textColor')}</span>
            <ColorPalette value={element.color} onChange={(c) => onPatch({ color: c })} label={t('whiteboard.popover.textColor')} />
          </label>
          <label className="field">
            <span className="field-label">{t('whiteboard.popover.lineWidth', { defaultValue: 'Width' })}</span>
            <div className="wb-font-slider">
              <input type="range" min={1} max={20} step={1} value={element.width} onChange={(e) => onPatch({ width: Number(e.target.value) })} aria-label={t('whiteboard.popover.lineWidth', { defaultValue: 'Width' })} />
              <input type="number" className="input wb-font-input" min={1} max={20} step={1} value={element.width} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onPatch({ width: Math.max(1, Math.min(20, v)) }); }} />
            </div>
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{isText ? t('whiteboard.popover.textLabel') : t('whiteboard.popover.stickyTextLabel')}</span>
            <textarea
              ref={firstInputRef as unknown as React.RefObject<HTMLTextAreaElement>}
              className="textarea"
              rows={isText ? 2 : 2}
              maxLength={isText ? 1000 : 500}
              placeholder={t('whiteboard.popover.typePlaceholder')}
              value={textValue()}
              onChange={(e) => onPatch({ text: e.target.value })}
              onKeyDown={(e) => commitText(e, true)}
            />
          </label>
          {isText ? (
            <>
              <label className="field">
                <span className="field-label">{t('whiteboard.popover.textColor')}</span>
                <ColorPalette value={elColor()} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.textColor')} />
              </label>
              {renderFontSize((element as WhiteboardText).fontSize, 16)}
              {renderAlign((element as WhiteboardText).align)}
            </>
          ) : (
            <>
              <label className="field" style={{ marginTop: 8 }}>
                <span className="field-label">{t('whiteboard.popover.background')}</span>
                <ColorPalette value={elColor()} onChange={(color) => onPatch({ color })} label={t('whiteboard.popover.background')} />
              </label>
              <label className="field" style={{ marginTop: 8 }}>
                <span className="field-label">{t('whiteboard.popover.textColor')}</span>
                <ColorPalette value={(element as WhiteboardSticky).textColor ?? 'rgba(6,5,4,0.85)'} onChange={(c) => onPatch({ textColor: c })} label={t('whiteboard.popover.textColor')} />
              </label>
              {renderFontSize((element as WhiteboardSticky).fontSize, 12)}
              {renderAlign((element as WhiteboardSticky).align)}
            </>
          )}
        </>
      )}
    </div>
  );
}
