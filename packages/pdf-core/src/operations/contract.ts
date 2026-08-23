import type { DeviceCapabilities, ProgressUpdate } from "@paperzero/shared";
import type { WorkerPool } from "../worker/pool";

export interface OperationContext {
  signal: AbortSignal;
  onProgress: (progress: ProgressUpdate) => void;
  logger: SafeLogger;
  capabilities: DeviceCapabilities;
  pool?: WorkerPool;
}

export interface SafeLogger {
  debug(message: string): void;
  warn(message: string): void;
}

export const safeLogger: SafeLogger = {
  debug: (message) => {
    if (typeof console !== "undefined") console.debug(`[paperzero] ${message}`);
  },
  warn: (message) => {
    if (typeof console !== "undefined") console.warn(`[paperzero] ${message}`);
  },
};

export interface ResourceEstimate {
  memoryRiskBytes?: number;
  heavyJob: boolean;
  notes?: string[];
}

export type OperationStatus =
  | "idle"
  | "files-selected"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

export interface OperationResult<T> {
  data: T;
  warnings: string[];
  stats: {
    durationMs: number;
    inputBytes: number;
    outputBytes?: number;
  };
}

export interface DocumentOperation<TInput, TOptions, TData> {
  id: string;
  title: string;
  validate(input: TInput, options: TOptions): Promise<void>;
  estimate?(input: TInput, options: TOptions): Promise<ResourceEstimate>;
  execute(
    input: TInput,
    options: TOptions,
    context: OperationContext
  ): Promise<OperationResult<TData>>;
}
