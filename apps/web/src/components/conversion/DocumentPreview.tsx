"use client";

import type { DocumentBlock, PortableDocument } from "@paperzero/pdf-conversion";

export function DocumentPreview({ document }: { document: PortableDocument }) {
  const blocks = document.blocks.slice(0, 80);
  return (
    <section aria-label="Safe live preview" className="min-h-[360px] rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Safe structural preview · first 80 blocks</p>
      {blocks.length === 0 ? <p className="text-sm text-slate-400">Start typing or import a text document to preview it here.</p> : blocks.map((block, index) => <PreviewBlock key={index} block={block} />)}
      {document.blocks.length > blocks.length ? <p className="mt-4 text-xs text-slate-500">Preview truncated; all bounded source content will be paginated during export.</p> : null}
    </section>
  );
}

function PreviewBlock({ block }: { block: DocumentBlock }) {
  const text = "runs" in block ? block.runs.map((run) => run.text).join("") : "";
  switch (block.kind) {
    case "heading": {
      const className = block.level === 1 ? "mt-5 text-2xl" : block.level === 2 ? "mt-4 text-xl" : "mt-3 text-base";
      return <p className={`${className} font-bold`} style={{ textAlign: block.align }}>{text}</p>;
    }
    case "paragraph":
      return <p className="my-2 whitespace-pre-wrap text-sm leading-6" style={{ textAlign: block.align }}>{block.runs.map((run, index) => <span key={index} style={{ fontWeight: run.bold ? 700 : undefined, fontStyle: run.italic ? "italic" : undefined, textDecoration: run.underline ? "underline" : undefined }}>{run.text}</span>)}</p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return <Tag className={`my-2 pl-6 text-sm ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item, index) => <li key={index}>{item.map((run) => run.text).join("")}</li>)}</Tag>;
    }
    case "code":
      return <pre className="my-3 overflow-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-900"><code>{block.text}</code></pre>;
    case "quote":
      return <blockquote className="my-3 border-l-4 border-slate-300 pl-3 text-sm italic dark:border-slate-600">{text}</blockquote>;
    case "table":
      return <div className="my-3 overflow-auto"><table className="min-w-full border-collapse text-xs"><tbody>{block.rows.slice(0, 30).map((row, rowIndex) => <tr key={rowIndex} className={block.striped && rowIndex % 2 ? "bg-slate-50 dark:bg-slate-900" : ""}>{row.map((cell, cellIndex) => { const Tag = rowIndex < (block.headerRows ?? 0) ? "th" : "td"; return <Tag key={cellIndex} className="border border-slate-300 px-2 py-1 text-left dark:border-slate-700">{cell.runs.map((run) => run.text).join("")}</Tag>; })}</tr>)}</tbody></table></div>;
    case "image":
      return <div className="my-3 rounded-lg bg-slate-100 p-8 text-center text-xs text-slate-500 dark:bg-slate-900">Embedded image{block.alt ? `: ${block.alt}` : ""}</div>;
    case "rule":
      return <hr className="my-4 border-slate-300 dark:border-slate-700" />;
    case "page-break":
      return <div className="my-5 border-t-2 border-dashed border-blue-300 pt-1 text-center text-[10px] uppercase text-blue-500">Page break</div>;
  }
}
