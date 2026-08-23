"use client";

import { useEffect, useRef, useState } from "react";
import { loadPdfDocument } from "@paperzero/pdf-core";
import { renderPageToCanvas } from "@paperzero/pdf-core";
import type { LocalDocumentFile } from "@paperzero/pdf-core";

export interface LivePagePreviewProps {
  file: LocalDocumentFile;
  pageNumber?: number;
  widthCss?: number;
  overlay?: (info: OverlayInfo) => React.ReactNode;
  onInfo?: (info: PreviewInfo) => void;
  children?: (info: OverlayInfo & { pageCount: number }) => React.ReactNode;
}

export interface OverlayInfo {
  scale: number;
  widthPt: number;
  heightPt: number;
}

export interface PreviewInfo extends OverlayInfo {
  pageCount: number;
}

export function LivePagePreview({
  file,
  pageNumber = 1,
  widthCss = 640,
  overlay,
  onInfo,
  children,
}: LivePagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number; pages: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const pdf = await loadPdfDocument(file);
        if (cancelled) return;
        const safePage = Math.min(Math.max(1, pageNumber), pdf.numPages);
        const page = await pdf.getPage(safePage);
        const base = page.getViewport({ scale: 1 });
        const nextDims = { w: base.width, h: base.height, pages: pdf.numPages };
        setDims(nextDims);
        page.cleanup();
        if (!cancelled) {
          onInfo?.({ scale: widthCss / nextDims.w, widthPt: nextDims.w, heightPt: nextDims.h, pageCount: nextDims.pages });
        }
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        await renderPageToCanvas(pdf, safePage, {
          canvas,
          targetWidthCss: widthCss,
          devicePixelRatioCap: 2,
        });
      } catch {
        if (!cancelled) setError("Preview could not be rendered for this page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onInfo is a notification callback, not a data dependency
  }, [file, pageNumber, widthCss]);

  if (error) {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  const scale = dims ? widthCss / dims.w : 1;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700"
        style={{ width: widthCss }}
      >
        <canvas ref={canvasRef} aria-label={`Preview of page ${pageNumber}`} role="img" className="block h-auto w-full" />
        {dims ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {overlay
              ? overlay({ scale, widthPt: dims.w, heightPt: dims.h })
              : null}
            {children
              ? children({ scale, widthPt: dims.w, heightPt: dims.h, pageCount: dims.pages })
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function overlayTextStyle(
  fontSizePt: number,
  colorHex: string,
  opacity: number,
  rotationDeg: number,
  scale: number
): React.CSSProperties {
  return {
    position: "absolute",
    whiteSpace: "nowrap",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontWeight: 700,
    fontSize: `${fontSizePt * scale}px`,
    lineHeight: 1,
    color: colorHex,
    opacity,
    transform: `rotate(${-rotationDeg}deg)`,
    transformOrigin: "left top",
  };
}
