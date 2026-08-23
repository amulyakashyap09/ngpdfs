"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPdfDocument,
  renderPageToCanvas,
  getPageTextItems,
} from "@paperzero/pdf-core";
import type { LocalDocumentFile } from "@paperzero/pdf-core";
import type {
  EditorObject,
  EditorTool,
  EditorImageSource,
} from "@paperzero/pdf-editor";
import { clamp, normalizeDragRect } from "@paperzero/pdf-editor";
import {
  ZOOM_STEPS,
  TOOL_LABELS,
  nextEditorId,
  objectPosition,
  moveObject,
  cssRectForObject,
  rgbToCss,
  urlForBytes,
  createBitmap,
} from "./editor-helpers";
import { Button } from "./primitives";
import { PageThumbnail } from "./PageThumbnail";
import { SignatureModal } from "./SignatureModal";

export interface PdfEditorProps {
  file: LocalDocumentFile;
  allowedTools?: EditorTool[];
  initialSignature?: { ref: string; bytes: Uint8Array; type: "png" | "jpeg" } | null;
  onExport: (objects: EditorObject[], images: EditorImageSource[]) => void;
  exporting?: boolean;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

interface DrawState {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

interface TextHit {
  x: number;
  y: number;
  w: number;
  h: number;
  baseline: number;
  str: string;
  size: number;
}

export function PdfEditor({
  file,
  allowedTools,
  initialSignature,
  onExport,
  exporting,
}: PdfEditorProps) {
  const tools: EditorTool[] =
    allowedTools && allowedTools.length > 0
      ? allowedTools
      : ["select", "text", "whiteout", "image", "edit-text"];
  const [tool, setTool] = useState<EditorTool>(tools[0] ?? "select");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [images, setImages] = useState<Map<string, EditorImageSource>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(null);
  const [textHits, setTextHits] = useState<TextHit[] | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const drawRef = useRef<DrawState | null>(null);
  const [, forcePreview] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStack = useRef<EditorObject[][]>([]);
  const redoStack = useRef<EditorObject[][]>([]);
  const imageUrlsRef = useRef<Map<string, string>>(new Map());

  const widthCss = ZOOM_STEPS[zoomIdx] ?? 560;
  const scale = pageDims ? widthCss / pageDims.w : 1;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        if (!cancelled) setPageCount(pdf.numPages);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open this PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        if (cancelled) return;
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });
        setPageDims({ w: viewport.width, h: viewport.height });
        page.cleanup();
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        await renderPageToCanvas(pdf, pageIndex + 1, {
          canvas,
          targetWidthCss: widthCss,
          devicePixelRatioCap: 2,
        });
      } catch {
        if (!cancelled) setError("This page could not be rendered.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex, widthCss]);

  useEffect(() => {
    if (tool !== "edit-text" || !pageDims) {
      setTextHits(null);
      return;
    }
    let cancelled = false;
    setTextHits(null);
    (async () => {
      try {
        const pdf = await loadPdfDocument(file);
        const page = await pdf.getPage(pageIndex + 1);
        const items = await getPageTextItems(page);
        page.cleanup();
        if (cancelled) return;
        const hits: TextHit[] = [];
        for (const item of items) {
          if (!item.str.trim()) continue;
          const e = item.transform[4] ?? 0;
          const f = item.transform[5] ?? 0;
          const size = Math.abs(item.transform[3] ?? item.height ?? 12) || 12;
          hits.push({
            x: e - 0.5,
            y: f - size * 0.28,
            w: (item.width || size * item.str.length * 0.5) + 1,
            h: size * 1.18,
            baseline: f,
            str: item.str,
            size,
          });
        }
        setTextHits(hits);
      } catch {
        if (!cancelled) setTextHits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tool, pageIndex, file, pageDims]);

  useEffect(() => {
    if (initialSignature && !images.has(initialSignature.ref)) {
      setImages((prev) => new Map(prev).set(initialSignature.ref, initialSignature));
      imageUrlsRef.current.set(initialSignature.ref, urlForBytes(initialSignature.bytes, initialSignature.type));
    }
  }, [initialSignature, images]);

  useEffect(() => {
    const urls = imageUrlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const commit = useCallback((updater: (prev: EditorObject[]) => EditorObject[]) => {
    setObjects((prev) => {
      undoStack.current.push(prev);
      redoStack.current = [];
      return updater(prev);
    });
  }, []);

  const pointerToPdf = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const overlay = overlayRef.current;
      if (!overlay || !pageDims) return null;
      const bounds = overlay.getBoundingClientRect();
      const cssX = clamp(event.clientX - bounds.left, 0, bounds.width);
      const cssY = clamp(event.clientY - bounds.top, 0, bounds.height);
      return {
        cssX,
        cssY,
        pt: { x: cssX / scale, y: pageDims.h - cssY / scale },
      };
    },
    [pageDims, scale]
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (exporting) return;
    const point = pointerToPdf(event);
    if (!point) return;
    lastPointRef.current = point.pt;
    if (tool === "image") {
      event.preventDefault();
      imageInputRef.current?.click();
      return;
    }
    if (tool === "whiteout") {
      drawRef.current = { startX: point.pt.x, startY: point.pt.y, curX: point.pt.x, curY: point.pt.y };
      forcePreview((n) => n + 1);
      overlayRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === "select") setSelectedId(null);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawRef.current && pageDims) {
      const point = pointerToPdf(event);
      if (!point) return;
      drawRef.current.curX = clamp(point.pt.x, 0, pageDims.w);
      drawRef.current.curY = clamp(point.pt.y, 0, pageDims.h);
      forcePreview((n) => n + 1);
      return;
    }
    const drag = dragRef.current;
    if (!drag || !pageDims) return;
    const dxPt = (event.clientX - drag.startX) / scale;
    const dyPt = -(event.clientY - drag.startY) / scale;
    setObjects((prev) =>
      prev.map((obj) =>
        obj.id === drag.id
          ? moveObject(obj, drag.origX + dxPt, drag.origY + dyPt)
          : obj
      )
    );
  };

  const handlePointerUp = () => {
    const draw = drawRef.current;
    if (draw) {
      const rect = normalizeDragRect({ x: draw.startX, y: draw.startY }, { x: draw.curX, y: draw.curY });
      drawRef.current = null;
      forcePreview((n) => n + 1);
      if (rect.width > 4 && rect.height > 3) {
        const id = nextEditorId("wo");
        commit((prev) => [
          ...prev,
          { kind: "whiteout", id, pageIndex, x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: [1, 1, 1] },
        ]);
        setSelectedId(id);
      }
      return;
    }
    dragRef.current = null;
  };

  const startMove = (event: React.PointerEvent, obj: EditorObject) => {
    if (tool !== "select" || exporting) return;
    event.stopPropagation();
    setSelectedId(obj.id);
    const pos = objectPosition(obj);
    dragRef.current = { id: obj.id, startX: event.clientX, startY: event.clientY, origX: pos.x, origY: pos.y };
  };

  const addTextAt = (pt: { x: number; y: number }) => {
    const id = nextEditorId("tx");
    commit((prev) => [
      ...prev,
      { kind: "text", id, pageIndex, x: pt.x, y: pt.y, size: 14, bold: false, color: [0.05, 0.05, 0.05], text: "" },
    ]);
    setSelectedId(id);
    setEditingTextId(id);
    setTool("select");
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (tool !== "text" || exporting) return;
    const point = pointerToPdf(event);
    if (point && pageDims) addTextAt(point.pt);
  };

  const handleHitClick = (hit: TextHit) => {
    if (tool !== "edit-text") return;
    const id = nextEditorId("rt");
    commit((prev) => [
      ...prev,
      {
        kind: "replace-text",
        id,
        pageIndex,
        coverX: hit.x,
        coverY: hit.y,
        coverWidth: hit.w,
        coverHeight: hit.h,
        baselineY: hit.baseline,
        newText: hit.str,
        size: hit.size,
        color: [0.05, 0.05, 0.05],
        originalText: hit.str,
      },
    ]);
    setSelectedId(id);
    setEditingTextId(id);
  };

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit((prev) => prev.filter((o) => o.id !== selectedId));
    setSelectedId(null);
    setEditingTextId(null);
  }, [selectedId, commit]);

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(objects);
    setObjects(previous);
    setSelectedId(null);
    setEditingTextId(null);
  }, [objects]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(objects);
    setObjects(next);
    setSelectedId(null);
    setEditingTextId(null);
  }, [objects]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !typing) {
        event.preventDefault();
        deleteSelected();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key === "Escape") {
        setSelectedId(null);
        setEditingTextId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, deleteSelected, undo, redo]);

  const acceptImageFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !pageDims) return;
    const isPng = f.type === "image/png" || /\.png$/i.test(f.name);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const ref = nextEditorId("img");
    const bitmap = await createBitmap(bytes);
    const naturalW = bitmap?.width ?? 200;
    const naturalH = bitmap?.height ?? 100;
    bitmap?.close?.();
    const widthPt = Math.min(pageDims.w * 0.5, 220);
    const heightPt = (naturalH / Math.max(1, naturalW)) * widthPt;
    const anchor = lastPointRef.current ?? { x: pageDims.w * 0.25, y: pageDims.h * 0.4 };
    imageUrlsRef.current.set(ref, urlForBytes(bytes, isPng ? "png" : "jpeg"));
    setImages((prev) => new Map(prev).set(ref, { ref, type: isPng ? "png" : "jpeg", bytes }));
    commit((prev) => [
      ...prev,
      {
        kind: "image",
        id: nextEditorId("im"),
        pageIndex,
        imageRef: ref,
        x: anchor.x,
        y: clamp(anchor.y + heightPt, heightPt, pageDims.h),
        width: widthPt,
        height: heightPt,
        opacity: 1,
      },
    ]);
    setTool("select");
  };

  const handleSignatureCreated = (result: { bytes: Uint8Array }) => {
    setShowSignModal(false);
    if (!pageDims) return;
    const ref = nextEditorId("sig");
    const aspect = 500 / 160;
    const widthPt = Math.min(pageDims.w * 0.35, 180);
    const heightPt = widthPt / aspect;
    const anchor = lastPointRef.current ?? { x: pageDims.w * 0.2, y: pageDims.h * 0.25 };
    imageUrlsRef.current.set(ref, urlForBytes(result.bytes, "png"));
    setImages((prev) => new Map(prev).set(ref, { ref, type: "png", bytes: result.bytes }));
    commit((prev) => [
      ...prev,
      {
        kind: "image",
        id: nextEditorId("sg"),
        pageIndex,
        imageRef: ref,
        x: anchor.x,
        y: clamp(anchor.y + heightPt, heightPt, pageDims.h),
        width: widthPt,
        height: heightPt,
        opacity: 1,
      },
    ]);
    setTool("select");
  };

  const selected = objects.find((o) => o.id === selectedId) ?? null;

  const updateSelected = (patch: Record<string, unknown>) => {
    if (!selectedId) return;
    commit((prev) => prev.map((o) => (o.id === selectedId ? ({ ...o, ...patch } as EditorObject) : o)));
  };

  if (error) {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  const canExport = objects.length > 0 && !exporting;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
        role="toolbar"
        aria-label="Editor tools"
      >
        {tools.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tool === t}
            onClick={() => {
              setTool(t);
              if (t !== "select") setSelectedId(null);
            }}
            className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tool === t
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {TOOL_LABELS[t]}
          </button>
        ))}
        {tools.includes("image") ? (
          <Button variant="secondary" onClick={() => setShowSignModal(true)}>
            Signature…
          </Button>
        ) : null}
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
        <ToolbarBtn label="Undo" disabled={undoStack.current.length === 0} onClick={undo}>↶</ToolbarBtn>
        <ToolbarBtn label="Redo" disabled={redoStack.current.length === 0} onClick={redo}>↷</ToolbarBtn>
        <ToolbarBtn label="Delete selected" disabled={!selectedId} onClick={deleteSelected}>✕</ToolbarBtn>
        <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
        <ToolbarBtn label="Zoom out" disabled={zoomIdx === 0} onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}>−</ToolbarBtn>
        <ToolbarBtn label="Zoom in" disabled={zoomIdx === ZOOM_STEPS.length - 1} onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}>+</ToolbarBtn>
        <span className="ml-auto flex items-center gap-1">
          <ToolbarBtn label="Previous page" disabled={pageIndex === 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>◀</ToolbarBtn>
          <span className="min-w-[90px] text-center text-xs tabular-nums text-slate-600 dark:text-slate-300" role="status">
            Page {pageIndex + 1}{pageCount ? ` / ${pageCount}` : ""}
          </span>
          <ToolbarBtn label="Next page" disabled={pageCount === null || pageIndex >= pageCount - 1} onClick={() => setPageIndex((i) => Math.min((pageCount ?? 1) - 1, i + 1))}>▶</ToolbarBtn>
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-950">
        {pageCount && pageCount > 1 ? (
          <ol className="flex shrink-0 gap-2" aria-label="Page thumbnails">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => (
              <li key={pageNumber}>
                <button
                  type="button"
                  onClick={() => setPageIndex(pageNumber - 1)}
                  aria-label={`Go to page ${pageNumber}`}
                  aria-current={pageIndex === pageNumber - 1}
                  className={`rounded-lg p-1 ${pageIndex === pageNumber - 1 ? "ring-2 ring-blue-500" : "opacity-70 hover:opacity-100"}`}
                >
                  <PageThumbnail file={file} pageNumber={pageNumber} width={64} className="w-16" />
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mx-auto w-fit">
          <div
            ref={overlayRef}
            role="application"
            aria-label={`Page editing canvas. Current tool: ${TOOL_LABELS[tool]}`}
            className={`relative select-none overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 ${
              tool === "whiteout" ? "cursor-crosshair" : tool === "text" ? "cursor-text" : tool === "edit-text" ? "cursor-pointer" : "cursor-default"
            }`}
            style={{ width: widthCss }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handleOverlayClick}
          >
            <canvas ref={canvasRef} className="block h-auto w-full" aria-label={`Page ${pageIndex + 1}`} role="img" />

            {tool === "edit-text" && textHits
              ? textHits.map((hit, i) => {
                  const rect = cssRectForObject(
                    { kind: "replace-text", id: `hit${i}`, pageIndex, coverX: hit.x, coverY: hit.y, coverWidth: hit.w, coverHeight: hit.h, baselineY: hit.baseline, newText: "", size: hit.size, color: [0, 0, 0], originalText: hit.str },
                    pageDims?.h ?? 0,
                    scale
                  );
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHitClick(hit);
                      }}
                      title={hit.str}
                      className="absolute border border-blue-400/60 bg-blue-400/10 hover:bg-blue-400/30"
                      style={{ left: rect.left, top: rect.top, width: rect.width, height: Math.max(8, rect.height) }}
                    />
                  );
                })
              : null}

            {objects
              .filter((o) => o.pageIndex === pageIndex)
              .map((obj) => {
                const rect = cssRectForObject(obj, pageDims?.h ?? 0, scale);
                const isSelected = obj.id === selectedId;
                const ring = isSelected ? "outline outline-2 outline-blue-500" : "";
                if (obj.kind === "whiteout") {
                  return (
                    <div
                      key={obj.id}
                      onPointerDown={(e) => startMove(e, obj)}
                      className={`absolute cursor-move border border-dashed ${ring} ${isSelected ? "border-blue-400 bg-white/95" : "border-transparent bg-white"}`}
                      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                    />
                  );
                }
                if (obj.kind === "image") {
                  const url = imageUrlsRef.current.get(obj.imageRef);
                  return (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={obj.id}
                      src={url}
                      alt="Placed image or signature"
                      onPointerDown={(e) => startMove(e, obj)}
                      draggable={false}
                      className={`absolute cursor-move ${ring}`}
                      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, opacity: obj.opacity ?? 1 }}
                    />
                  );
                }
                if (obj.kind === "text") {
                  const lines = obj.text.split("\n");
                  return (
                    <div
                      key={obj.id}
                      onPointerDown={(e) => startMove(e, obj)}
                      className={`absolute whitespace-pre font-sans leading-tight ${ring} ${tool === "select" ? "cursor-move" : ""}`}
                      style={{
                        left: rect.left,
                        top: rect.top,
                        fontSize: `${obj.size * scale}px`,
                        lineHeight: 1.25,
                        fontWeight: obj.bold ? 700 : 400,
                        color: rgbToCss(obj.color),
                      }}
                    >
                      {editingTextId === obj.id ? (
                        <textarea
                          autoFocus
                          value={obj.text}
                          onChange={(e) => updateSelected({ text: e.target.value })}
                          onBlur={() => {
                            setEditingTextId(null);
                            setObjects((prev) => prev.filter((o) => !(o.id === obj.id && o.kind === "text" && o.text.trim() === "")));
                          }}
                          rows={Math.max(1, lines.length)}
                          className="w-full min-w-[160px] resize rounded border border-blue-500 bg-yellow-50/95 p-0.5 font-sans text-inherit outline-none dark:bg-yellow-100/95 dark:text-black"
                          style={{ fontSize: `${obj.size * scale}px`, lineHeight: 1.25 }}
                        />
                      ) : (
                        obj.text || <span className="italic opacity-50">empty</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div
                    key={obj.id}
                    onPointerDown={(e) => startMove(e, obj)}
                    className={`absolute cursor-move border-2 border-dashed border-orange-400/80 bg-orange-200/20 ${ring}`}
                    style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                    title={`Replaces: ${obj.originalText}`}
                  />
                );
              })}

            {drawRef.current && pageDims ? (() => {
              const rect = normalizeDragRect(
                { x: drawRef.current!.startX, y: drawRef.current!.startY },
                { x: drawRef.current!.curX, y: drawRef.current!.curY }
              );
              return (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-200/40"
                  style={{
                    left: rect.x * scale,
                    top: (pageDims.h - rect.y - rect.height) * scale,
                    width: rect.width * scale,
                    height: rect.height * scale,
                  }}
                />
              );
            })() : null}
          </div>
        </div>

        <aside className="w-56 shrink-0" aria-label="Selected object properties">
          {selected ? (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{selected.kind}</p>
              {selected.kind === "text" ? (
                <>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Text
                    <textarea
                      value={selected.text}
                      onChange={(e) => updateSelected({ text: e.target.value })}
                      rows={3}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Size {selected.size}pt
                    <input type="range" min={6} max={72} value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) })} className="w-full accent-blue-600" />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={selected.bold} onChange={(e) => updateSelected({ bold: e.target.checked })} className="accent-blue-600" />
                    Bold
                  </label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Color
                    <input type="color" value={rgbToHex(selected.color)} onChange={(e) => updateSelected({ color: hexToRgb01(e.target.value) })} className="mt-1 block h-9 w-full rounded border border-slate-300 dark:border-slate-600" />
                  </label>
                </>
              ) : null}
              {selected.kind === "replace-text" ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Original: “{selected.originalText}”</p>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Replacement
                    <textarea
                      value={selected.newText}
                      onChange={(e) => updateSelected({ newText: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Size {selected.size}pt
                    <input type="range" min={4} max={48} value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) })} className="w-full accent-blue-600" />
                  </label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Color
                    <input type="color" value={rgbToHex(selected.color)} onChange={(e) => updateSelected({ color: hexToRgb01(e.target.value) })} className="mt-1 block h-9 w-full rounded border border-slate-300 dark:border-slate-600" />
                  </label>
                </>
              ) : null}
              {selected.kind === "image" ? (
                <>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Width {Math.round(selected.width)}pt
                    <input
                      type="range"
                      min={24}
                      max={480}
                      value={selected.width}
                      onChange={(e) => {
                        const w = Number(e.target.value);
                        const aspect = selected.height / Math.max(1, selected.width);
                        updateSelected({ width: w, height: w * aspect });
                      }}
                      className="w-full accent-blue-600"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Opacity {Math.round((selected.opacity ?? 1) * 100)}%
                    <input type="range" min={10} max={100} value={(selected.opacity ?? 1) * 100} onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })} className="w-full accent-blue-600" />
                  </label>
                </>
              ) : null}
              <Button variant="danger" onClick={deleteSelected}>Delete</Button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
              {tool === "select"
                ? "Select an object to edit its properties. Drag objects to move them."
                : tool === "edit-text"
                  ? "Click any text on the page to replace it."
                  : TOOL_HINTS[tool]}
            </p>
          )}
        </aside>
      </div>

      {tool === "edit-text" && textHits && textHits.length === 0 ? (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          This page appears to be scanned or has no selectable text. OCR-assisted editing is planned for a later release.
        </p>
      ) : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Whiteout covers content visually — it is not secure redaction.
      </p>

      <Button onClick={() => onExport(objects, [...images.values()])} disabled={!canExport}>
        Apply edits & download ({objects.length} change{objects.length === 1 ? "" : "s"})
      </Button>

      <SignatureModal open={showSignModal} onCancel={() => setShowSignModal(false)} onConfirm={handleSignatureCreated} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
        className="sr-only"
        aria-label="Add image file"
        onChange={(e) => {
          void acceptImageFile(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ToolbarBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-300 px-2 text-sm text-slate-700 hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

const TOOL_HINTS: Partial<Record<EditorTool, string>> = {
  text: "Click anywhere on the page to place a text box.",
  whiteout: "Drag a rectangle over content you want to visually cover.",
  image: "Click where the top-left of the image should go, then pick a file.",
};

export function rgbToHex(color: [number, number, number]): string {
  const hex = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(color[0])}${hex(color[1])}${hex(color[2])}`;
}

export function hexToRgb01(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16) / 255,
    parseInt(v.slice(2, 4), 16) / 255,
    parseInt(v.slice(4, 6), 16) / 255,
  ];
}
