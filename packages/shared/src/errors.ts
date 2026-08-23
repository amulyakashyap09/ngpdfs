export const ERROR_CODES = [
  "INVALID_INPUT",
  "UNSUPPORTED_FILE",
  "FILE_CORRUPT",
  "ENCRYPTED_PDF",
  "PASSWORD_REQUIRED",
  "WRONG_PASSWORD",
  "MEMORY_LIMIT",
  "WORKER_FAILED",
  "WASM_LOAD_FAILED",
  "OUTPUT_INVALID",
  "CANCELLED",
  "TIMEOUT",
  "STORAGE_UNAVAILABLE",
  "QUOTA_EXCEEDED",
  "BROWSER_UNSUPPORTED",
  "UNKNOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ProgressUpdate {
  phase: string;
  completed?: number;
  total?: number;
  percentage?: number;
  message?: string;
}

const RECOVERY: Record<ErrorCode, string> = {
  INVALID_INPUT: "Check the selected file and try again.",
  UNSUPPORTED_FILE: "Choose a file type supported by this tool.",
  FILE_CORRUPT: "The file appears damaged. Try another copy of the document.",
  ENCRYPTED_PDF:
    "This PDF is password protected. Remove the password first using your PDF viewer, then retry.",
  PASSWORD_REQUIRED: "This PDF requires a password to open.",
  WRONG_PASSWORD: "That password did not work. Check it and try again.",
  MEMORY_LIMIT:
    "This job likely exceeds this device's memory. Try fewer pages, a lower quality setting, or a desktop browser.",
  WORKER_FAILED: "Background processing failed. Retry; if it repeats, reload the page.",
  WASM_LOAD_FAILED: "A processing engine failed to load. Check your connection and reload.",
  OUTPUT_INVALID:
    "The generated file failed validation. Nothing broken on your side - please retry.",
  CANCELLED: "Operation cancelled. Your original files were not modified.",
  TIMEOUT: "The operation took too long and was stopped. Try smaller input or lower settings.",
  STORAGE_UNAVAILABLE:
    "Browser storage is unavailable (private mode?). The tool still works without saved history.",
  QUOTA_EXCEEDED: "Browser storage is full. Clear old history or free space, then retry.",
  BROWSER_UNSUPPORTED:
    "Your browser does not support a required feature. Try the latest Chrome, Edge, Firefox or Safari.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export class PaperZeroError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;

  constructor(code: ErrorCode, userMessage?: string, internalMessage?: string) {
    super(internalMessage ?? userMessage ?? code);
    this.name = "PaperZeroError";
    this.code = code;
    this.userMessage = userMessage ?? RECOVERY[code];
  }

  static cancelled(): PaperZeroError {
    return new PaperZeroError("CANCELLED");
  }
}

export function isCancelled(error: unknown): boolean {
  return (
    error instanceof PaperZeroError && error.code === "CANCELLED"
  );
}

export function toPaperZeroError(error: unknown): PaperZeroError {
  if (error instanceof PaperZeroError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return PaperZeroError.cancelled();
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/encrypted/i.test(message)) {
    return new PaperZeroError("ENCRYPTED_PDF", undefined, message);
  }
  if (/password/i.test(message)) {
    return new PaperZeroError("WRONG_PASSWORD", undefined, message);
  }
  if (/quota/i.test(message)) {
    return new PaperZeroError("QUOTA_EXCEEDED", undefined, message);
  }
  return new PaperZeroError("UNKNOWN", undefined, message);
}

export function assertNotAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw PaperZeroError.cancelled();
}
