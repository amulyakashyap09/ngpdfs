import { useCallback, useRef, useState } from "react";
import { PaperZeroError, isCancelled, toPaperZeroError, type ProgressUpdate } from "@paperzero/shared";
import type { OperationStatus } from "@paperzero/pdf-core";

export type OperationTask<R> = (
  signal: AbortSignal,
  onProgress: (progress: ProgressUpdate) => void
) => Promise<{ data: R; warnings?: string[] }>;

export interface UseOperationState<R> {
  status: OperationStatus;
  progress: ProgressUpdate | null;
  result: R | null;
  error: PaperZeroError | null;
  warnings: string[];
}

export interface UseOperationReturn<R> extends UseOperationState<R> {
  start: (task: OperationTask<R>) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  isProcessing: boolean;
}

export function useOperation<R>(): UseOperationReturn<R> {
  const [state, setState] = useState<UseOperationState<R>>({
    status: "idle",
    progress: null,
    result: null,
    error: null,
    warnings: [],
  });
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (task: OperationTask<R>) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({
        status: "processing",
        progress: { phase: "starting", message: "Preparing…" },
        result: null,
        error: null,
        warnings: [],
      });
      try {
        const outcome = await task(controller.signal, (progress) =>
          setState((prev) => ({ ...prev, progress }))
        );
        if (controller.signal.aborted) throw PaperZeroError.cancelled();
        setState({
          status: "success",
          progress: null,
          result: outcome.data,
          error: null,
          warnings: outcome.warnings ?? [],
        });
      } catch (error) {
        const pze = toPaperZeroError(error);
        if (isCancelled(pze)) {
          setState((prev) => ({
            ...prev,
            status: "cancelled",
            progress: null,
            error: pze,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            progress: null,
            error: pze,
          }));
        }
      }
    },
    []
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState({ status: "idle", progress: null, result: null, error: null, warnings: [] });
  }, []);

  return { ...state, start, cancel, reset, isProcessing: state.status === "processing" };
}
