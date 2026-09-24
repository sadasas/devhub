import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FE_LIMITS } from '../../lib/limits';
import { CaretDown, CaretUp, LockSimple, LockSimpleOpen, MagnifyingGlass } from '@phosphor-icons/react';
import { Tooltip } from '../../components/Tooltip';
import type { WhiteboardElement } from '../../lib/types';

interface WhiteboardLayersProps {
  elements: WhiteboardElement[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder?: (ids: string[]) => void;
  /** WB-11: panel collapses upward via its header; Properties never collapses. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
    case 'embed':
      return el.title ? el.title.slice(0, 32) || 'Embed' : 'Embed';
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
    case 'embed': return '▦';
    case 'stroke': return '✎';
    default: return '•';
  }
}

export function WhiteboardLayers({ elements, selectedIds, onSelect, onToggleLock, collapsed = false, onToggleCollapse }: WhiteboardLayersProps) {
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
      <Tooltip content={collapsed ? t('whiteboard.layers.expand') : t('whiteboard.layers.collapse')} side="top">
        <button
          type="button"
          className="wb-layers-head"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('whiteboard.layers.expand') : t('whiteboard.layers.collapse')}
          onClick={() => onToggleCollapse?.()}
        >
          <span className="wb-layers-title">{t('whiteboard.layers.title')}</span>
          <span className="wb-layers-count">{elements.length}</span>
          <span className="wb-layers-caret" aria-hidden="true">
            {collapsed ? <CaretDown size={12} /> : <CaretUp size={12} />}
          </span>
        </button>
      </Tooltip>
      {!collapsed && (
        <>
          <label className="wb-layers-search">
        <MagnifyingGlass size={12} aria-hidden="true" />
        <input
          className="wb-layers-input"
          placeholder={t('whiteboard.layers.searchPlaceholder')}
          value={query}
          maxLength={FE_LIMITS.SEARCH}
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
        </>
      )}
    </div>
  );
}
