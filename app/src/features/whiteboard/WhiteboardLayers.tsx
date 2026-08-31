import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LockSimple, LockSimpleOpen, MagnifyingGlass } from '@phosphor-icons/react';
import type { WhiteboardElement } from '../../lib/types';

interface WhiteboardLayersProps {
  elements: WhiteboardElement[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder?: (ids: string[]) => void;
}

function elementLabel(el: WhiteboardElement): string {
  switch (el.kind) {
    case 'sticky':
      return el.text ? el.text.slice(0, 32) || 'Sticky' : 'Sticky';
    case 'text':
      return el.text ? el.text.slice(0, 32) || 'Text' : 'Text';
    case 'shape':
      return el.label || el.shapeType;
    case 'edge':
      return el.label || 'Edge';
    case 'boundary':
      return el.label || 'Boundary';
    case 'ref':
      return `${el.entity}:${el.entityId.slice(0, 6)}`;
    case 'stroke':
      return 'Stroke';
    default:
      return 'unknown';
  }
}

function kindIcon(kind: WhiteboardElement['kind']): string {
  switch (kind) {
    case 'sticky': return '▭';
    case 'text': return 'T';
    case 'shape': return '⬔';
    case 'edge': return '→';
    case 'boundary': return '▢';
    case 'ref': return '🔗';
    case 'stroke': return '✎';
    default: return '•';
  }
}

export function WhiteboardLayers({ elements, selectedIds, onSelect, onToggleLock }: WhiteboardLayersProps) {
  const { t } = useTranslation('extras');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...elements].reverse(); // top first
    if (!q) return list;
    return list.filter((el) => {
      const label = elementLabel(el).toLowerCase();
      return label.toLowerCase().includes(q) || el.kind.toLowerCase().includes(q);
    });
  }, [elements, query]);

  return (
    <div className="wb-layers">
      <div className="wb-layers-head">
        <span className="wb-layers-title">{t('whiteboard.layers.title')}</span>
        <span className="wb-layers-count">{elements.length}</span>
      </div>
      <label className="wb-layers-search">
        <MagnifyingGlass size={12} aria-hidden="true" />
        <input
          className="wb-layers-input"
          placeholder={t('whiteboard.layers.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="wb-layers-list" role="listbox" aria-label={t('whiteboard.layers.listLabel')}>
        {filtered.length === 0 ? (
          <p className="wb-layers-empty">{t('whiteboard.layers.empty')}</p>
        ) : (
          filtered.map((el) => {
            const active = selectedIds.includes(el.id);
            return (
              <button
                key={el.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`wb-layer-row${active ? ' wb-layer-row-active' : ''}`}
                onClick={() => onSelect(el.id)}
              >
                <span className="wb-layer-kind" aria-hidden="true">{kindIcon(el.kind)}</span>
                <span className="wb-layer-label">{elementLabel(el)}</span>
                <span className="wb-layer-kind-label">{el.kind}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="wb-layer-lock"
                  aria-label={el.locked ? t('whiteboard.canvas.unlock') : t('whiteboard.canvas.lock')}
                  onClick={(e) => { e.stopPropagation(); onToggleLock(el.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleLock(el.id); } }}
                >
                  {el.locked ? <LockSimple size={12} aria-hidden="true" /> : <LockSimpleOpen size={12} aria-hidden="true" />}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
