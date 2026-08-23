export type RGB = [number, number, number];

export interface BaseObject {
  id: string;
  pageIndex: number;
}

export interface TextObject extends BaseObject {
  kind: "text";
  x: number;
  y: number;
  size: number;
  bold: boolean;
  color: RGB;
  text: string;
  maxWidthPt?: number;
}

export interface WhiteoutObject extends BaseObject {
  kind: "whiteout";
  x: number;
  y: number;
  width: number;
  height: number;
  color: RGB;
}

export interface ImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
}

export interface ImageObject extends BaseObject, ImagePlacement {
  kind: "image";
  imageRef: string;
}

export interface ReplaceTextObject extends BaseObject {
  kind: "replace-text";
  coverX: number;
  coverY: number;
  coverWidth: number;
  coverHeight: number;
  baselineY: number;
  newText: string;
  size: number;
  color: RGB;
  originalText: string;
}

export type EditorObject = TextObject | WhiteoutObject | ImageObject | ReplaceTextObject;

export type EditorTool = "select" | "text" | "whiteout" | "image" | "edit-text";

export interface EditorImageSource {
  ref: string;
  type: "png" | "jpeg";
  bytes: Uint8Array;
}

export function isTextual(obj: EditorObject): obj is TextObject | ReplaceTextObject {
  return obj.kind === "text" || obj.kind === "replace-text";
}
