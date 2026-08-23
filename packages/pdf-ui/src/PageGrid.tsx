"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalDocumentFile } from "@paperzero/pdf-core";
import { loadPdfDocument } from "@paperzero/pdf-core";
import { PageThumbnail } from "./PageThumbnail";

export interface GridPage {
  key: string;
  srcIndex: number;
  rotation: number;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `p_${keyCounter}`;
}

export interface PageGridProps {
  file: LocalDocumentFile;
  onChange?: (pages: GridPage[]) => void;
  allowDelete?: boolean;
  allowDuplicate?: boolean;
}

export function PageGrid({ file, onChange, allowDelete = true, allowDuplicate = true }: PageGridProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pages, setPages] = useState<GridPage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const undoStack = useRef<GridPage[][]>([]);
  const redoStack = useRef<GridPage[][]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        if (cancelled) return;
        const count = pdf.numPages;
        setPageCount(count);
        setPages(Array.from({ length: count }, (_, i) => ({ key: nextKey(), srcIndex: i, rotation: 0 })));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open this PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const commit = useCallback(
    (updater: (prev: GridPage[]) => GridPage[]) => {
      setPages((prev) => {
        undoStack.current.push(prev);
        redoStack.current = [];
        const next = updater(prev);
        onChange?.(next);
        return next;
      });
    },
    [onChange]
  );

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };


  const rotateSelectedOrAll = (delta: number) => {
    commit((prev) =>
      prev.map((p) =>
        selected.has(p.key) || selected.size === 0
          ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 }
          : p
      )
    );
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    commit((prev) => prev.filter((p) => !selected.has(p.key)));
    setSelected(new Set());
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    commit((prev) => {
      const next: GridPage[] = [];
      for (const p of prev) {
        next.push(p);
        if (selected.has(p.key)) next.push({ key: nextKey(), srcIndex: p.srcIndex, rotation: p.rotation });
      }
      return next;
    });
  };

  const movePage = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return;
    commit((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  const resetAll = () => {
    if (pageCount === null) return;
    undoStack.current.push(pages);
    redoStack.current = [];
    const fresh = Array.from({ length: pageCount }, (_, i) => ({ key: nextKey(), srcIndex: i, rotation: 0 }));
    setPages(fresh);
    onChange?.(fresh);
    setSelected(new Set());
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(pages);
    setPages(previous);
    onChange?.(previous);
  };

  const redo = () => {
    const nextPages = redoStack.current.pop();
    if (!nextPages) return;
    undoStack.current.push(pages);
    setPages(nextPages);
    onChange?.(nextPages);
  };

  if (error) {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (pageCount === null) {
    return <div role="status" className="text-sm text-slate-500">Loading pages…</div>;
  }

  return (
    <section aria-label="Page editor">
      <div className="mb-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Page actions">
        <GridButton onClick={() => setSelected(new Set(pages.map((p) => p.key)))}>Select all</GridButton>
        <GridButton onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Deselect</GridButton>
        <GridButton onClick={() => rotateSelectedOrAll(-90)}>{selected.size ? "Rotate ⟲ selection" : "Rotate all ⟲"}</GridButton>
        <GridButton onClick={() => rotateSelectedOrAll(90)}>{selected.size ? "Rotate ⟳ selection" : "Rotate all ⟳"}</GridButton>
        {allowDelete ? (
          <GridButton variant="danger" onClick={deleteSelected} disabled={selected.size === 0}>
            Delete ({selected.size})
          </GridButton>
        ) : null}
        {allowDuplicate ? (
          <GridButton onClick={duplicateSelected} disabled={selected.size === 0}>
            Duplicate
          </GridButton>
        ) : null}
        <GridButton onClick={undo} disabled={undoStack.current.length === 0}>Undo</GridButton>
        <GridButton onClick={redo} disabled={redoStack.current.length === 0}>Redo</GridButton>
        <GridButton onClick={resetAll}>Reset</GridButton>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400" role="status">
          {pages.length} page{pages.length === 1 ? "" : "s"} · {selected.size} selected
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Pages">
        {pages.map((page, index) => {
          const isSelected = selected.has(page.key);
          return (
            <li key={page.key} className={`rounded-xl border-2 p-2 transition-colors ${isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "border-transparent"}`}>
              <label className="flex cursor-pointer flex-col items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(page.key)}
                  aria-label={`Select page ${page.srcIndex + 1}`}
                  className="h-5 w-5 accent-blue-600"
                />
                <div style={{ transform: `rotate(${page.rotation}deg)` }} className="transition-transform">
                  <PageThumbnail file={file} pageNumber={page.srcIndex + 1} width={140} className="w-full" />
                </div>
              </label>
              <div className="mt-1 flex items-center justify-center gap-1">
                <button type="button" aria-label={`Move page ${index + 1} earlier`} disabled={index === 0} onClick={() => movePage(index, index - 1)} className="min-h-[32px] min-w-[32px] rounded px-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">◀</button>
                <button type="button" aria-label={`Rotate page ${index + 1}`} onClick={() => commit((prev) => prev.map((p) => (p.key === page.key ? { ...p, rotation: (p.rotation + 90) % 360 } : p)))} className="min-h-[32px] min-w-[32px] rounded px-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">⟳</button>
                <button type="button" aria-label={`Move page ${index + 1} later`} disabled={index === pages.length - 1} onClick={() => movePage(index, index + 1)} className="min-h-[32px] min-w-[32px] rounded px-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">▶</button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GridButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-40 ${
        variant === "danger"
          ? "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function descriptorsFromPages(pages: GridPage[]): Array<{ index: number; rotateDelta: number }> {
  return pages.map((p) => ({ index: p.srcIndex, rotateDelta: p.rotation }));
}
