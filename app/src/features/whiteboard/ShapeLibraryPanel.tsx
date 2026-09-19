import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { WhiteboardShape } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';
import { ShapeThumb } from './ShapeThumb';
import {
  LIBRARY_ITEM_BY_ID,
  readShapeRecent,
  SHAPE_LIBRARY_TABS,
  type LibraryItem,
  type ShapeLibraryTabId,
} from './libraries';

interface ShapeLibraryPanelProps {
  onPick: (item: LibraryItem) => void;
  onClose: () => void;
}

function Thumb({ shapeType }: { shapeType: WhiteboardShape['shapeType'] }) {
  return (
    <span className="wb-morethumb" aria-hidden="true">
      <ShapeThumb shapeType={shapeType} />
    </span>
  );
}

const AUTO_FOCUS_INPUT =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover)').matches
    : true;

/**
 * FigJam More-shapes panel (Image 5→6): big panel above the bottom pill with
 * tabs, search, recent and a thumbnail grid. Items are presets over the 10
 * geometric shapeTypes — everything shown is placeable as-is.
 */
export function ShapeLibraryPanel({ onPick, onClose }: ShapeLibraryPanelProps) {
  const { t } = useTranslation('extras');
  const [tab, setTab] = useState<ShapeLibraryTabId>('basic');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => readShapeRecent());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (AUTO_FOCUS_INPUT) inputRef.current?.focus();
  }, []);

  const tabs = useMemo(
    () => SHAPE_LIBRARY_TABS.map((tb) => ({ id: tb.id, label: t(tb.labelKey) })),
    [t],
  );

  const filtered = useMemo(() => {
    const items = SHAPE_LIBRARY_TABS.find((tb) => tb.id === tab)?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.shapeType.toLowerCase().includes(q));
  }, [tab, query]);

  useEffect(() => {
    setActive(0);
  }, [tab, query]);

  const recentItems = useMemo(
    () => recent.map((id) => LIBRARY_ITEM_BY_ID.get(id)).filter((i): i is LibraryItem => Boolean(i)),
    [recent],
  );

  const pick = (item: LibraryItem) => {
    setRecent(readShapeRecent());
    onPick(item);
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (filtered.length === 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % filtered.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[active];
      if (item) pick(item);
    }
  };

  return (
    <div className="wb-morepanel" role="dialog" aria-label={t('whiteboard.shapeLib.title')} onKeyDown={onGridKeyDown}>
      <div className="wb-moretabs" role="group" aria-label={t('whiteboard.shapeLib.title')}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`wb-moretab${tab === tb.id ? ' wb-moretab-active' : ''}`}
            aria-pressed={tab === tb.id}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <label className="wb-moresearch">
        <input
          ref={inputRef}
          className="input"
          placeholder={t('whiteboard.shapeLib.search')}
          aria-label={t('whiteboard.shapeLib.searchAria')}
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {recentItems.length > 0 && query.trim() === '' && (
        <div className="wb-morerecent">
          <span className="wb-morerecent-head">{t('whiteboard.shapeLib.recent')}</span>
            <div className="wb-morerecent-row" role="group" aria-label={t('whiteboard.shapeLib.recent')}>
              {recentItems.map((item) => (
                <Tooltip key={item.id} content={item.name} side="top">
                  <button
                    type="button"
                    className="wb-moreopt"
                    aria-label={item.name}
                    onClick={() => pick(item)}
                  >
                    <Thumb shapeType={item.shapeType} />
                  </button>
                </Tooltip>
              ))}
            </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="wb-moreempty" role="status">
          {t('whiteboard.shapeLib.empty')}
        </p>
      ) : (
        <div className="wb-moregrid" role="listbox" aria-label={tbLabel(tab, tabs)}>
          {filtered.map((item, i) => (
            <Tooltip key={item.id} content={item.name} side="top">
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`wb-moreopt${i === active ? ' wb-moreopt-active' : ''}`}
                aria-label={item.name}
                onClick={() => pick(item)}
                onMouseEnter={() => setActive(i)}
              >
                <Thumb shapeType={item.shapeType} />
                <span className="wb-morename">{item.name}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

function tbLabel(tab: ShapeLibraryTabId, tabs: Array<{ id: ShapeLibraryTabId; label: string }>): string {
  return tabs.find((tb) => tb.id === tab)?.label ?? tab;
}
