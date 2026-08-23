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
}

export interface OverlayInfo {
  scale: number;
  widthPt: number;
  heightPt: number;
}

export function LivePagePreview({ file, pageNumber = 1, widthCss = 640, overlay }: LivePagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const pdf = await loadPdfDocument(file);
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        setDims({ w: base.width, h: base.height });
        page.cleanup();
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        await renderPageToCanvas(pdf, pageNumber, {
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
        {overlay && dims ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {overlay({ scale, widthPt: dims.w, heightPt: dims.h })}
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
