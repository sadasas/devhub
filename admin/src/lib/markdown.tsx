import type { ReactNode } from "react";

type MdBlock =
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "para"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "quote"; text: string }
  | { type: "codeblock"; lang: string; text: string };

const INLINE_RE = /(\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\))|(\*\*[^*]+\*\*)|(_[^_]+_)|(`[^`]+`)/g;

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseLines(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let list: MdBlock | null = null;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];

  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trimEnd();

    // code block fence
    const fence = trimmed.trim().match(/^```(\w*)\s*$/);
    if (fence) {
      if (inCode) {
        blocks.push({ type: "codeblock", lang: codeLang, text: codeBuf.join("\n") });
        inCode = false;
        codeLang = "";
        codeBuf = [];
      } else {
        flushList();
        inCode = true;
        codeLang = fence[1] ?? "";
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (trimmed.trim() === "") {
      flushList();
      continue;
    }

    const heading = trimmed.trim().match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2] ?? "" });
      continue;
    }

    const quote = trimmed.trim().match(/^>\s+(.*)$/);
    if (quote) {
      flushList();
      blocks.push({ type: "quote", text: quote[1] ?? "" });
      continue;
    }

    const ul = trimmed.trim().match(/^[-*•]\s+(.*)$/);
    const ol = trimmed.trim().match(/^\d+[.)]\s+(.*)$/);

    if (ul) {
      if (!list || list.type !== "list" || list.ordered) flushList();
      if (!list) list = { type: "list", ordered: false, items: [] };
      list.items.push(ul[1] ?? "");
    } else if (ol) {
      if (!list || list.type !== "list" || !list.ordered) flushList();
      if (!list) list = { type: "list", ordered: true, items: [] };
      list.items.push(ol[1] ?? "");
    } else {
      flushList();
      blocks.push({ type: "para", text: trimmed.trim() });
    }
  }

  if (inCode) {
    blocks.push({ type: "codeblock", lang: codeLang, text: codeBuf.join("\n") });
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
    if (token.startsWith("[")) {
      const label = m[2] ?? "";
      const href = m[3] ?? "";
      if (isSafeUrl(href)) {
        nodes.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="md-link">
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("_")) {
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
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          const Tag = b.level === 1 ? "h3" : b.level === 2 ? "h3" : "h4";
          return (
            <Tag key={i} className="md-heading">
              {renderInline(b.text)}
            </Tag>
          );
        }
        if (b.type === "quote") {
          return (
            <blockquote key={i} className="md-quote">
              {renderInline(b.text)}
            </blockquote>
          );
        }
        if (b.type === "codeblock") {
          return (
            <pre key={i} className="md-pre">
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.type === "list") {
          return b.ordered ? (
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
          );
        }
        return <p key={i}>{renderInline(b.text)}</p>;
      })}
    </div>
  );
}
