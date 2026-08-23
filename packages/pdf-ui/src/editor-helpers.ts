import { clamp } from "@paperzero/pdf-editor";
import type { EditorObject, EditorTool } from "@paperzero/pdf-editor";

export const ZOOM_STEPS = [420, 560, 700, 880];

export const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Select",
  text: "Add text",
  whiteout: "Whiteout",
  image: "Image",
  "edit-text": "Edit text",
};

let counter = 0;
export function nextEditorId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

export function objectPosition(obj: EditorObject): { x: number; y: number } {
  switch (obj.kind) {
    case "text":
      return { x: obj.x, y: obj.y };
    case "whiteout":
      return { x: obj.x, y: obj.y };
    case "image":
      return { x: obj.x, y: obj.y };
    case "replace-text":
      return { x: obj.coverX, y: obj.coverY };
  }
}

export function moveObject(obj: EditorObject, x: number, y: number): EditorObject {
  switch (obj.kind) {
    case "text":
      return { ...obj, x, y };
    case "whiteout":
      return { ...obj, x, y };
    case "image":
      return { ...obj, x, y };
    case "replace-text": {
      const dx = x - obj.coverX;
      const dy = y - obj.coverY;
      return {
        ...obj,
        coverX: obj.coverX + dx,
        coverY: obj.coverY + dy,
        baselineY: obj.baselineY + dy,
      };
    }
  }
}

export function objectSize(obj: EditorObject, scale: number): { w: number; h: number } {
  switch (obj.kind) {
    case "whiteout":
      return { w: obj.width * scale, h: obj.height * scale };
    case "image":
      return { w: obj.width * scale, h: obj.height * scale };
    case "replace-text":
      return { w: obj.coverWidth * scale, h: obj.coverHeight * scale };
    case "text": {
      const lines = Math.max(1, obj.text.split("\n").length);
      return { w: Math.max(40, obj.text.length) * obj.size * 0.55 * scale, h: lines * obj.size * 1.25 * scale };
    }
  }
}

export function cssRectForObject(
  obj: EditorObject,
  pageHeightPt: number,
  scale: number
): { left: number; top: number; width: number; height: number } {
  const pos = objectPosition(obj);
  const size = objectSize(obj, scale);
  if (obj.kind === "replace-text") {
    return {
      left: pos.x * scale,
      top: (pageHeightPt - pos.y - obj.coverHeight) * scale,
      width: size.w,
      height: size.h,
    };
  }
  if (obj.kind === "image" || obj.kind === "whiteout") {
    return {
      left: pos.x * scale,
      top: (pageHeightPt - pos.y - obj.height) * scale,
      width: size.w,
      height: size.h,
    };
  }
  return {
    left: pos.x * scale,
    top: (pageHeightPt - pos.y) * scale,
    width: size.w,
    height: size.h,
  };
}

export function rgbToCss(color: [number, number, number]): string {
  const to255 = (v: number) => Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${to255(color[0])}, ${to255(color[1])}, ${to255(color[2])})`;
}

export function urlForBytes(bytes: Uint8Array, type: "png" | "jpeg"): string {
  return URL.createObjectURL(
    new Blob([bytes.slice().buffer as ArrayBuffer], { type: type === "png" ? "image/png" : "image/jpeg" })
  );
}

export async function createBitmap(bytes: Uint8Array): Promise<{
  width: number;
  height: number;
  close?: () => void;
} | null> {
  try {
    return await createImageBitmap(
      new Blob([bytes.slice().buffer as ArrayBuffer])
    );
  } catch {
    return null;
  }
}
