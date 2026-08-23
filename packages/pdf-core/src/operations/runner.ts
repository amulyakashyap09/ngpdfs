import {
  PaperZeroError,
  assertNotAborted,
  toPaperZeroError,
  type ProgressUpdate,
  type DeviceCapabilities,
} from "@paperzero/shared";
import type { DocumentOperation, OperationContext, OperationResult, ResourceEstimate, SafeLogger } from "./contract";
import { safeLogger as defaultLogger } from "./contract";

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ProgressUpdate) => void;
  capabilities?: DeviceCapabilities;
  logger?: SafeLogger;
  pool?: OperationContext["pool"];
  confirmHeavyJob?: (estimate: ResourceEstimate) => boolean | Promise<boolean>;
}

export async function runOperation<TInput, TOptions, TData>(
  operation: DocumentOperation<TInput, TOptions, TData>,
  input: TInput,
  options: TOptions,
  runOptions: RunOptions = {}
): Promise<OperationResult<TData>> {
  const logger = runOptions.logger ?? defaultLogger;
  const controller = new AbortController();
  const externalSignal = runOptions.signal;
  const forwardAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) {
    throw PaperZeroError.cancelled();
  }
  externalSignal?.addEventListener("abort", forwardAbort, { once: true });

  const startedAt = Date.now();
  const context: OperationContext = {
    signal: controller.signal,
    onProgress: (progress) => runOptions.onProgress?.(progress),
    logger,
    capabilities:
      runOptions.capabilities ??
      ({
        deviceClass: "desktop",
        memoryClass: "unknown",
        hardwareConcurrency: 4,
        isSafariFamily: false,
        isIOS: false,
        maxRecommendedFileBytes: 150 * 1024 * 1024,
        warnFileBytes: 100 * 1024 * 1024,
        maxRecommendedRenderDPI: 600,
        maxCanvasDimension: 16384,
        maxCanvasPixels: 64 * 1024 * 1024,
        maxPagesPerRenderBatch: 8,
        maxWorkerConcurrency: 2,
        warnings: [],
      } satisfies DeviceCapabilities),
    pool: runOptions.pool,
  };

  try {
    await operation.validate(input, options);
    assertNotAborted(controller.signal);

    if (operation.estimate && context.pool === undefined) {
      const estimate = await operation.estimate(input, options);
      if (estimate.heavyJob && runOptions.confirmHeavyJob) {
        const proceed = await runOptions.confirmHeavyJob(estimate);
        if (!proceed) throw PaperZeroError.cancelled();
      }
    }

    const result = await operation.execute(input, options, context);
    assertNotAborted(controller.signal);
    return result;
  } catch (error) {
    throw toPaperZeroError(error);
  } finally {
    externalSignal?.removeEventListener("abort", forwardAbort);
    computeDuration(startedAt);
  }
}

function computeDuration(startedAt: number): number {
  return Math.max(1, Date.now() - startedAt);
}

export function totalBytesOf(blobs: Array<{ size: number }>): number {
  return blobs.reduce((sum, b) => sum + b.size, 0);
}
