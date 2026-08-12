import React from "react";

/** Inline formatting: **bold** and `code`. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={`${keyBase}-b${i++}`} className="font-bold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={`${keyBase}-c${i++}`}
          className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[0.85em] font-medium text-[var(--status-success-fg)]"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Renders Copilot markdown-lite: paragraphs, - / numbered lists, --- dividers, **bold**, `code`. */
export default function RichText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    if (list.ordered) {
      blocks.push(
        <ol key={`ol${key++}`} className="my-1.5 list-decimal space-y-1 pr-5">
          {items.map((it, i) => (
            <li key={i} dir="auto" className="leading-relaxed">
              {inline(it, `oli${i}`)}
            </li>
          ))}
        </ol>,
      );
    } else {
      blocks.push(
        <ul key={`ul${key++}`} className="my-1.5 space-y-1">
          {items.map((it, i) => (
            <li key={i} dir="auto" className="flex gap-2 leading-relaxed">
              <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[var(--status-success-fg)]" />
              <span className="min-w-0">{inline(it, `uli${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "---" || trimmed === "***") {
      flushList();
      blocks.push(<hr key={`hr${key++}`} className="my-2.5 border-t border-black/10" />);
      continue;
    }
    const heading = /^#{1,4}\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      blocks.push(
        <p key={`h${key++}`} dir="auto" className="mb-1 mt-2.5 t-body-sm font-bold text-[var(--status-success-fg)] first:mt-0">
          {inline(heading[1], `h${key}`)}
        </p>,
      );
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (list && list.ordered) flushList();
      if (!list) list = { ordered: false, items: [] };
      list.items.push(bullet[1]);
      continue;
    }
    if (numbered) {
      if (list && !list.ordered) flushList();
      if (!list) list = { ordered: true, items: [] };
      list.items.push(numbered[1]);
      continue;
    }
    flushList();
    if (trimmed === "") {
      blocks.push(<div key={`sp${key++}`} className="h-2" />);
      continue;
    }
    blocks.push(
      <p key={`p${key++}`} dir="auto" className="leading-relaxed">
        {inline(trimmed, `p${key}`)}
      </p>,
    );
  }
  flushList();

  return <div className="t-body">{blocks}</div>;
}
