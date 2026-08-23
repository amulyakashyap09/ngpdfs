export interface AnalyticsEvent {
  toolId: string;
  eventName:
    | "tool_opened"
    | "file_selected"
    | "processing_started"
    | "processing_completed"
    | "processing_failed"
    | "download_clicked"
    | "related_tool_clicked"
    | "cancel_clicked";
  deviceClass?: string;
  fileSizeBucket?: string;
  pageCountBucket?: string;
  durationBucket?: string;
  success?: boolean;
  errorCode?: string;
}

export interface SanitizeResult {
  sanitized: AnalyticsEvent;
  droppedKeys: string[];
}

const ALLOWED_KEYS = new Set([
  "toolId",
  "eventName",
  "deviceClass",
  "fileSizeBucket",
  "pageCountBucket",
  "durationBucket",
  "success",
  "errorCode",
]);

export function sanitizeEvent(event: Record<string, unknown>): SanitizeResult {
  const droppedKeys: string[] = [];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!ALLOWED_KEYS.has(key)) {
      droppedKeys.push(key);
      continue;
    }
    if (typeof value === "string" && value.length > 64) {
      droppedKeys.push(key);
      continue;
    }
    sanitized[key] = value;
  }
  return { sanitized: sanitized as unknown as AnalyticsEvent, droppedKeys };
}

export interface AnalyticsAdapter {
  track(event: AnalyticsEvent): void;
}

class NoopAdapter implements AnalyticsAdapter {
  track(): void {}
}

let adapter: AnalyticsAdapter = new NoopAdapter();

export function setAnalyticsAdapter(next: AnalyticsAdapter): void {
  adapter = next;
}

export function getAnalyticsAdapter(): AnalyticsAdapter {
  return adapter;
}

export function trackEvent(raw: Partial<AnalyticsEvent>): void {
  try {
    if (raw.eventName === undefined || raw.toolId === undefined) return;
    const { sanitized } = sanitizeEvent(raw as Record<string, unknown>);
    const host = window as unknown as { __pzEvents?: unknown[] };
    if (typeof window !== "undefined" && Array.isArray(host.__pzEvents)) {
      host.__pzEvents.push(sanitized);
    }
    adapter.track(sanitized);
  } catch {
    void 0;
  }
}
