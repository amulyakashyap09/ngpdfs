export type DeviceClass = "mobile" | "tablet" | "desktop";
export type MemoryClass = "low" | "standard" | "high" | "unknown";

export interface DeviceCapabilities {
  deviceClass: DeviceClass;
  memoryClass: MemoryClass;
  hardwareConcurrency: number;
  isSafariFamily: boolean;
  isIOS: boolean;
  maxRecommendedFileBytes: number;
  warnFileBytes: number;
  maxRecommendedRenderDPI: number;
  maxCanvasDimension: number;
  maxCanvasPixels: number;
  maxPagesPerRenderBatch: number;
  maxWorkerConcurrency: number;
  warnings: string[];
}

const MB = 1024 * 1024;

const CLASS_POLICY: Record<DeviceClass, Omit<DeviceCapabilities, "deviceClass" | "memoryClass" | "hardwareConcurrency" | "isSafariFamily" | "isIOS" | "warnings">> = {
  mobile: {
    maxRecommendedFileBytes: 50 * MB,
    warnFileBytes: 30 * MB,
    maxRecommendedRenderDPI: 300,
    maxCanvasDimension: 8192,
    maxCanvasPixels: 16 * 1024 * 1024,
    maxPagesPerRenderBatch: 2,
    maxWorkerConcurrency: 2,
  },
  tablet: {
    maxRecommendedFileBytes: 75 * MB,
    warnFileBytes: 50 * MB,
    maxRecommendedRenderDPI: 300,
    maxCanvasDimension: 8192,
    maxCanvasPixels: 32 * 1024 * 1024,
    maxPagesPerRenderBatch: 4,
    maxWorkerConcurrency: 3,
  },
  desktop: {
    maxRecommendedFileBytes: 150 * MB,
    warnFileBytes: 100 * MB,
    maxRecommendedRenderDPI: 600,
    maxCanvasDimension: 16384,
    maxCanvasPixels: 64 * 1024 * 1024,
    maxPagesPerRenderBatch: 8,
    maxWorkerConcurrency: 4,
  },
};

function detectDeviceClass(ua: string, touchPoints: number): DeviceClass {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return "tablet";
  }
  if (/iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return "mobile";
  if (/Android|Mobile/i.test(ua)) return "mobile";
  if (Math.max(touchPoints, 0) >= 5 && /Macintosh/.test(ua)) return "tablet";
  return "desktop";
}

export function detectCapabilities(input?: {
  userAgent?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  screenArea?: number;
  maxTouchPoints?: number;
}): DeviceCapabilities {
  const ua = input?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const touch = input?.maxTouchPoints ?? (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0);
  const deviceClass = detectDeviceClass(ua, touch);
  const policy = CLASS_POLICY[deviceClass];

  const cores = Math.max(
    1,
    input?.hardwareConcurrency ??
      ((typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2)
  );

  const hints = input?.deviceMemory ?? (typeof navigator !== "undefined" ? (navigator as { deviceMemory?: number }).deviceMemory : undefined);
  let memoryClass: MemoryClass = "unknown";
  if (typeof hints === "number" && hints > 0) {
    memoryClass = hints <= 2 ? "low" : hints >= 8 ? "high" : "standard";
  }

  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && touch > 1);
  const isSafariFamily = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);

  const warnings: string[] = [];
  let effective = { ...policy };

  if (memoryClass === "low") {
    effective = {
      ...effective,
      maxRecommendedFileBytes: Math.min(effective.maxRecommendedFileBytes, 30 * MB),
      maxRecommendedRenderDPI: Math.min(effective.maxRecommendedRenderDPI, 150),
      maxPagesPerRenderBatch: Math.max(1, Math.floor(effective.maxPagesPerRenderBatch / 2)),
    };
    warnings.push("Low-memory device detected. Heavy operations will use conservative quality settings.");
  }
  if (isIOS || isSafariFamily) {
    effective.maxCanvasPixels = Math.min(effective.maxCanvasPixels, 16 * 1024 * 1024);
    effective.maxCanvasDimension = Math.min(effective.maxCanvasDimension, 8192);
    warnings.push("Safari limits total canvas size. Very high DPI exports may be reduced automatically.");
  }

  return {
    deviceClass,
    memoryClass,
    hardwareConcurrency: cores,
    isSafariFamily,
    isIOS,
    ...effective,
    maxWorkerConcurrency: Math.min(effective.maxWorkerConcurrency, Math.max(1, cores - 1), 6),
    warnings,
  };
}

export function defaultCapabilities(): DeviceCapabilities {
  return detectCapabilities({ userAgent: "", maxTouchPoints: 0 });
}
