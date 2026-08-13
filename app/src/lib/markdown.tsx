import type { ReactNode } from 'react';

type MdBlock =
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'para'; text: string };

const INLINE_RE = /(\*\*[^*]+\*\*)|(_[^_]+_)|(`[^`]+`)/g;

export function parseLines(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let list: MdBlock | null = null;

  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushList();
      continue;
    }

    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);

    if (ul) {
      if (!list || list.type !== 'list' || list.ordered) flushList();
      if (!list) list = { type: 'list', ordered: false, items: [] };
      list.items.push(ul[1] ?? '');
    } else if (ol) {
      if (!list || list.type !== 'list' || !list.ordered) flushList();
      if (!list) list = { type: 'list', ordered: true, items: [] };
      list.items.push(ol[1] ?? '');
    } else {
      flushList();
      blocks.push({ type: 'para', text: line.trim() });
    }
  }

  flushList();
  return blocks;
}

export function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('_')) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      nodes.push(
        <code key={key++} className="md-code">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return nodes;
}

export function MarkdownBlocks({ text }: { text: string }) {
  const blocks = parseLines(text);
  if (blocks.length === 0) return null;

  return (
    <div className="md-blocks">
      {blocks.map((b, i) =>
        b.type === 'list' ? (
          b.ordered ? (
            <ol key={i} className="md-list">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="md-list">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          )
        ) : (
          <p key={i}>{renderInline(b.text)}</p>
        ),
      )}
    </div>
  );
}