"use client";

import { useRef, useState } from "react";
import { Button, Checkbox, Field, LivePagePreview, NumberInput } from "@paperzero/pdf-ui";
import type { LocalDocumentFile } from "@paperzero/pdf-core";
import type { Rect } from "@paperzero/pdf-editor";
import { normalizeDragRect } from "@paperzero/pdf-editor";
import type { WorkerRunner } from "@paperzero/pdf-operations";
import { runCrop } from "@paperzero/pdf-operations";

import type { ResultFile } from "@paperzero/pdf-ui";

export interface CropPanelProps {
  file: LocalDocumentFile;
  exporting: boolean;
  runner: WorkerRunner;
  onRun: (task: RunTask) => void;
}

export type RunTask = (
  signal: AbortSignal,
  onProgress: (p: { phase: string; completed?: number; total?: number; message?: string }) => void
) => Promise<{ data: ResultFile[]; warnings?: string[] }>;

interface DrawState {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

export function CropWorkspace({ file, exporting, runner, onRun }: CropPanelProps) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [rect, setRect] = useState<Rect | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<DrawState | null>(null);
  const [, forcePreview] = useState(0);

  const toPoint = (event: { clientX: number; clientY: number }, heightPt: number, scale: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return null;
    const bounds = overlay.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const y = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height);
    return { x: x / scale, y: heightPt - y / scale };
  };

  const handleApply = () => {
    setError(null);
    if (!rect || rect.width < 4 || rect.height < 4) {
      setError("Drag a crop box over the preview first.");
      return;
    }
    onRun(async (signal, onProgress) => {
      const outcome = await runCrop(
        runner,
        file,
        { pageIndex: pageNumber - 1, rect, applyToAllPages: applyToAll },
        { signal, onProgress }
      );
      return { data: outcome.files, warnings: outcome.warnings };
    });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Drag a box on the preview to mark the area to keep. Cropping is structural
          (CropBox): content outside the box stays in the file but is hidden on screen
          and in print.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {!applyToAll ? (
            <Field label="Page" htmlFor="crop-page">
              <NumberInput
                id="crop-page"
                min={1}
                max={pageCount ?? 9999}
                value={pageNumber}
                onChange={(e) => setPageNumber(Math.min(pageCount ?? 9999, Math.max(1, Number(e.target.value))))}
              />
            </Field>
          ) : null}
          <div className="flex items-end pb-1">
            <Checkbox label="Apply this crop box to all pages" checked={applyToAll} onChange={setApplyToAll} />
          </div>
        </div>
        {error ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <Button onClick={handleApply} disabled={exporting}>
          {applyToAll ? "Crop all pages & download" : `Crop page ${pageNumber} & download`}
        </Button>
        {rect ? (
          <p className="text-xs text-slate-500 dark:text-slate-400" role="status">
            Area: {Math.round(rect.width)} × {Math.round(rect.height)} pt ·{" "}
            <button type="button" className="underline hover:no-underline" onClick={() => setRect(null)}>
              clear selection
            </button>
          </p>
        ) : null}
      </div>

      <aside className="w-full shrink-0 lg:w-[480px]" aria-label="Crop preview">
        <LivePagePreview
          file={file}
          pageNumber={pageNumber}
          widthCss={460}
          onInfo={(info) => setPageCount(info.pageCount)}
        >
          {({ scale, heightPt }) => (
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ touchAction: "none" }}
              role="application"
              aria-label="Crop area selector. Drag to draw the region to keep."
              onPointerDown={(event) => {
                event.preventDefault();
                const point = toPoint(event, heightPt, scale);
                if (!point) return;
                drawRef.current = { startX: point.x, startY: point.y, curX: point.x, curY: point.y };
                forcePreview((n) => n + 1);
              }}
              onPointerMove={(event) => {
                const d = drawRef.current;
                if (!d) return;
                const point = toPoint(event, heightPt, scale);
                if (!point) return;
                d.curX = point.x;
                d.curY = point.y;
                setRect(normalizeDragRect({ x: d.startX, y: d.startY }, { x: d.curX, y: d.curY }));
                forcePreview((n) => n + 1);
              }}
              onPointerUp={(event) => {
                const d = drawRef.current;
                if (!d) return;
                const point = toPoint(event, heightPt, scale);
                drawRef.current = null;
                forcePreview((n) => n + 1);
                if (point) {
                  d.curX = point.x;
                  d.curY = point.y;
                  setRect(normalizeDragRect({ x: d.startX, y: d.startY }, { x: d.curX, y: d.curY }));
                }
              }}
            >
              {rect ? (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-400/20"
                  style={{
                    left: rect.x * scale,
                    top: (heightPt - rect.y - rect.height) * scale,
                    width: rect.width * scale,
                    height: rect.height * scale,
                  }}
                />
              ) : null}
            </div>
          )}
        </LivePagePreview>
      </aside>
    </div>
  );
}
