import { PaperZeroError, toPaperZeroError, type ProgressUpdate } from "@paperzero/shared";
import type { WorkerResponse } from "@paperzero/pdf-core";
import { sha256Hex } from "./hash";
import { mergePdfBytes, type MergeInputFile } from "./ops/merge";
import { splitPdfBytes } from "./ops/split";
import { applyPageOperations, type PageDescriptor } from "./ops/pageops";
import {
  applyTextWatermark,
  applyImageWatermark,
  type TextWatermarkOptionsPayload,
  type ImageWatermarkOptionsPayload,
} from "./ops/watermark";
import { applyPageNumbers, type PageNumbersOptionsPayload } from "./ops/pagenumbers";
import { stripBasicMetadata } from "./ops/metadata";
import { imagesToPdf, type ImagesToPdfOptionsPayload, type NormalizedImage } from "./ops/imagestopdf";
import {
  applyEditorObjects,
  applyCrop,
  applyResize,
  applyHeadersFooters,
  flattenForms,
  fillAndSave,
  buildTextPages,
  type EditorExportPayload,
  type CropRequest,
  type ResizeOptionsPayload,
  type HeaderFooterOptions,
  type FormValuePayload,
  type TextPagesRequest,
} from "@paperzero/pdf-editor";
import {
  encryptPdf,
  decryptToPlainCopy,
  stripRestrictions,
  sanitizePdf,
  buildRedactedPdf,
  type EncryptOptionsPayload,
  type UserPermissions,
  type SanitizeOptionsPayload,
  type RedactBuildPayload,
} from "@paperzero/pdf-security";
import { buildSearchablePdf, type SearchablePdfPayload } from "@paperzero/pdf-ocr/assembly";
import { convertBinaryToPdf, convertSourceToPdf } from "@paperzero/pdf-conversion/worker";
import type { BinaryConversionPayload, ConversionPayload } from "@paperzero/pdf-conversion";
import { buildPdfExport, type PdfExportPayload } from "@paperzero/pdf-extraction/worker";
export type { WorkerDoneResult } from "./worker-types";

export interface WorkerTaskGuard {
  readonly cancelled: boolean;
  throwIfCancelled(): void;
  progress(progress: ProgressUpdate): void;
}

export interface PdfWorkerMessage {
  taskId?: string;
  type?: string;
  op?: string;
  payload?: unknown;
}

type OpHandler = (payload: any, guard: WorkerTaskGuard) => Promise<{ files: Array<{ name: string; bytes: Uint8Array }>; warnings: string[] }>;

const OPS: Record<string, OpHandler> = {
  "sha256": async (payload: { bytes: Uint8Array }) => {
    const hex = await sha256Hex(payload.bytes);
    return { files: [], warnings: [hex] };
  },
  "merge": async (payload: { files: MergeInputFile[] }, guard) => {
    return await mergePdfBytes(payload.files, guard);
  },
  "split": async (payload: { bytes: Uint8Array; baseName: string; segments: Array<{ start: number; end: number }> }, guard) => {
    return await splitPdfBytes(payload.bytes, { baseName: payload.baseName, segments: payload.segments }, guard);
  },
  "organize": async (payload: { bytes: Uint8Array; descriptors: PageDescriptor[] }, guard) => {
    return await applyPageOperations(payload.bytes, payload.descriptors, guard);
  },
  "watermark-text": async (payload: { bytes: Uint8Array; options: TextWatermarkOptionsPayload }, guard) => {
    return await applyTextWatermark(payload.bytes, payload.options, guard);
  },
  "watermark-image": async (payload: { bytes: Uint8Array; imageBytes: Uint8Array; options: ImageWatermarkOptionsPayload }, guard) => {
    return await applyImageWatermark(payload.bytes, payload.imageBytes, payload.options, guard);
  },
  "page-numbers": async (payload: { bytes: Uint8Array; options: PageNumbersOptionsPayload }, guard) => {
    return await applyPageNumbers(payload.bytes, payload.options, guard);
  },
  "remove-metadata": async (payload: { bytes: Uint8Array }, guard) => {
    return await stripBasicMetadata(payload.bytes, guard);
  },
  "images-to-pdf": async (payload: { images: NormalizedImage[]; options: ImagesToPdfOptionsPayload }, guard) => {
    return await imagesToPdf(payload.images, payload.options, guard);
  },
  "editor-export": async (payload: EditorExportPayload, guard) => {
    return await applyEditorObjects(payload, guard);
  },
  "crop": async (payload: { bytes: Uint8Array; request: CropRequest }, guard) => {
    return await applyCrop(payload.bytes, payload.request, guard);
  },
  "resize": async (payload: { bytes: Uint8Array; options: ResizeOptionsPayload }, guard) => {
    return await applyResize(payload.bytes, payload.options, guard);
  },
  "headers-footers": async (payload: { bytes: Uint8Array; options: HeaderFooterOptions }, guard) => {
    return await applyHeadersFooters(payload.bytes, payload.options, guard);
  },
  "flatten-forms": async (payload: { bytes: Uint8Array; rasterizeFallback?: boolean }, guard) => {
    return await flattenForms(payload.bytes, { rasterizeFallback: payload.rasterizeFallback }, guard);
  },
  "fill-form": async (
    payload: {
      bytes: Uint8Array;
      values: FormValuePayload[];
      options: { flattenAnswers?: boolean };
    },
    guard
  ) => {
    return await fillAndSave(payload.bytes, payload.values, payload.options, guard);
  },
  "text-pages": async (payload: TextPagesRequest, guard) => {
    return await buildTextPages(payload, guard);
  },
  "encrypt": async (
    payload: {
      bytes: Uint8Array;
      userPassword: string;
      ownerPassword?: string;
      permissions?: UserPermissions;
    },
    guard
  ) => {
    const options: EncryptOptionsPayload = {
      userPassword: payload.userPassword,
      ownerPassword: payload.ownerPassword,
      permissions: payload.permissions,
    };
    return await encryptPdf(payload.bytes, options, guard);
  },
  "decrypt-strip": async (payload: { bytes: Uint8Array; password: string }, guard) => {
    return await decryptToPlainCopy(payload.bytes, payload.password, guard);
  },
  "strip-restrictions": async (
    payload: { bytes: Uint8Array; password?: string },
    guard
  ) => {
    return await stripRestrictions(payload.bytes, payload.password, guard);
  },
  "sanitize": async (
    payload: { bytes: Uint8Array; options: SanitizeOptionsPayload },
    guard
  ) => {
    return await sanitizePdf(payload.bytes, payload.options, guard);
  },
  "redact-build": async (payload: RedactBuildPayload, guard) => {
    return await buildRedactedPdf(payload, guard);
  },
  "ocr-searchable-pdf": async (payload: SearchablePdfPayload, guard) => {
    return await buildSearchablePdf(payload, guard);
  },
  "convert-source-to-pdf": async (payload: ConversionPayload, guard) => {
    return await convertSourceToPdf(payload, guard);
  },
  "convert-binary-to-pdf": async (payload: BinaryConversionPayload, guard) => {
    return await convertBinaryToPdf(payload, guard);
  },
  "pdf-layout-export": async (payload: PdfExportPayload, guard) => {
    return await buildPdfExport(payload, guard);
  },
};

export type PostMessageFn = (
  message: WorkerResponse | { type: "cancel"; taskId: string },
  transfer?: Transferable[]
) => void;

export function createWorkerHandler(post: PostMessageFn) {
  const cancelledTasks = new Set<string>();

  return async function handleMessage(message: PdfWorkerMessage): Promise<void> {
    if (!message || typeof message.taskId !== "string") return;
    if (message.type === "cancel") {
      cancelledTasks.add(message.taskId);
      post({ taskId: message.taskId, type: "cancel-ack" });
      return;
    }
    if (message.type !== "op") return;
    const taskId = message.taskId;
    const guard: WorkerTaskGuard = {
      get cancelled() {
        return cancelledTasks.has(taskId);
      },
      throwIfCancelled() {
        if (guard.cancelled) throw PaperZeroError.cancelled();
      },
      progress(progress) {
        post({ taskId, type: "progress", progress });
      },
    };
    try {
      post({ taskId, type: "accepted" });
      const opName = message.op ?? "";
      const handler = OPS[opName];
      if (!handler) {
        throw new PaperZeroError("INVALID_INPUT", `Unknown operation "${opName}".`);
      }
      const result = await handler(message.payload, guard);
      if (guard.cancelled) throw PaperZeroError.cancelled();
      for (const file of result.files) {
        await validateOutputShim(file.bytes);
      }
      post(
        { taskId, type: "done", result },
        collectTransferables(result.files)
      );
    } catch (error) {
      const pze = toPaperZeroError(error);
      post({
        taskId,
        type: "error",
        code: pze.code === "CANCELLED" ? "CANCELLED" : pze.code,
        message: pze.userMessage,
      });
    } finally {
      cancelledTasks.delete(taskId);
    }
  };
}

async function validateOutputShim(bytes: Uint8Array): Promise<void> {
  if (bytes.length === 0) {
    throw new PaperZeroError("OUTPUT_INVALID", "The operation produced an empty file.");
  }
}

function collectTransferables(files: Array<{ name: string; bytes: Uint8Array }>): Transferable[] {
  const set = new Set<ArrayBuffer>();
  for (const file of files) {
    if (file.bytes.byteLength > 0 && file.bytes.byteOffset === 0) {
      set.add(file.bytes.buffer as ArrayBuffer);
    }
  }
  return [...set];
}
