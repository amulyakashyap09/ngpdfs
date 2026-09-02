import { createWorker, OEM, PSM, type Worker as TesseractWorker } from "tesseract.js";
import { PaperZeroError, type ProgressUpdate } from "@paperzero/shared";
import type { OcrLanguage, OcrPixelWord, OcrRecognitionResult } from "./types";

export class BrowserOcrSession {
  private worker: TesseractWorker | null = null;
  private cancelled = false;

  constructor(
    private readonly language: OcrLanguage,
    private readonly onProgress?: (progress: ProgressUpdate) => void
  ) {}

  async initialize(): Promise<void> {
    this.cancelled = false;
    try {
      this.worker = await createWorker(this.language, OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        cachePath: "paperzero-ocr-v1",
        cacheMethod: "write",
        workerBlobURL: false,
        gzip: true,
        errorHandler: () => undefined,
        logger: (message) => {
          this.onProgress?.({
            phase: message.status.replace(/\s+/g, "-"),
            completed: Math.round(message.progress * 100),
            total: 100,
            message: message.status,
          });
        },
      });
      await this.worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
        user_defined_dpi: "220",
      });
    } catch (error) {
      throw new PaperZeroError(
        "WASM_LOAD_FAILED",
        "The local OCR engine or language model could not be loaded. Reconnect once to cache it, then try again.",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async recognize(
    image: HTMLCanvasElement | Blob,
    dimensions: { width: number; height: number },
    options: { deskew: boolean }
  ): Promise<OcrRecognitionResult> {
    if (!this.worker) throw new PaperZeroError("WORKER_FAILED", "The OCR worker is not initialized.");
    if (this.cancelled) throw PaperZeroError.cancelled();
    const result = await this.worker.recognize(
      image,
      { rotateAuto: options.deskew },
      { text: true, blocks: true }
    );
    if (this.cancelled) throw PaperZeroError.cancelled();
    const words: OcrPixelWord[] = [];
    for (const block of result.data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            const text = word.text.trim();
            if (text) words.push({ text, confidence: word.confidence, bbox: word.bbox });
          }
        }
      }
    }
    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      words,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
    };
  }

  async terminate(): Promise<void> {
    this.cancelled = true;
    const worker = this.worker;
    this.worker = null;
    if (worker) await worker.terminate();
  }
}
