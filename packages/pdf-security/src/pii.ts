import { PaperZeroError } from "@paperzero/shared";

export type PiiType =
  | "email"
  | "phone"
  | "credit-card"
  | "aadhaar"
  | "pan"
  | "ip-address"
  | "url"
  | "custom";

export interface PiiMatch {
  type: PiiType;
  value: string;
  start: number;
  end: number;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(\d{2,5}\)[\s-]?)?(?:\d{4}[\s-]\d{3}[\s-]\d{3}|\d{3}[\s-]\d{3}[\s-]\d{4}|\d{5}[\s-]\d{5})/g;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

export function luhnValid(digits: string): boolean {
  const cleaned = digits.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  let sum = 0;
  let double = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let d = cleaned.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  const cleaned = digits.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(cleaned)) return false;
  let c = 0;
  const reversed = cleaned.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![Number(reversed[i])]!]!;
  }
  return c === 0;
}

export function panValid(value: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

function looksLikeCardContext(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - 24), start).toLowerCase();
  return /(card|visa|mastercard|amex|debit|credit|cc:)/.test(before);
}

export interface PiiDetectorOptions {
  email?: boolean;
  phone?: boolean;
  creditCard?: boolean;
  aadhaar?: boolean;
  pan?: boolean;
  ipAddress?: boolean;
  url?: boolean;
  customRegexes?: string[];
}

export const DEFAULT_DETECTOR_OPTIONS: Required<Pick<PiiDetectorOptions, "email" | "phone" | "creditCard" | "aadhaar" | "pan" | "ipAddress" | "url">> = {
  email: true,
  phone: true,
  creditCard: true,
  aadhaar: true,
  pan: true,
  ipAddress: true,
  url: false,
};

function collectMatches(text: string, regex: RegExp): PiiMatch[] {
  regex.lastIndex = 0;
  const out: PiiMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[0].length > 0) {
      out.push({ type: "custom", value: m[0], start: m.index, end: m.index + m[0].length });
    } else {
      // Global regular expressions do not reliably advance after a zero-width
      // match. Move forward explicitly so custom patterns such as ^ cannot hang.
      regex.lastIndex = m.index + 1;
    }
    if (out.length >= 10_000) break;
  }
  return out;
}

export function findPiiMatches(text: string, options: PiiDetectorOptions = {}): PiiMatch[] {
  const opts = { ...DEFAULT_DETECTOR_OPTIONS, ...options };
  const matches: PiiMatch[] = [];

  if (opts.email) for (const m of collectMatches(text, EMAIL_RE)) matches.push({ ...m, type: "email" });

  if (opts.creditCard) {
    for (const m of collectMatches(text, CARD_RE)) {
      if (luhnValid(m.value)) matches.push({ type: "credit-card", value: m.value.trim(), start: m.start, end: m.end });
      else if (looksLikeCardContext(text, m.start) && m.value.replace(/\D/g, "").length >= 13)
        matches.push({ type: "credit-card", value: m.value.trim(), start: m.start, end: m.end });
    }
  }

  if (opts.aadhaar) {
    for (const m of collectMatches(text, AADHAAR_RE)) {
      if (verhoeffValid(m.value)) matches.push({ type: "aadhaar", value: m.value.trim(), start: m.start, end: m.end });
    }
  }

  if (opts.pan) {
    for (const m of collectMatches(text, PAN_RE)) matches.push({ type: "pan", value: m.value, start: m.start, end: m.end });
  }

  if (opts.phone) {
    for (const m of collectMatches(text, PHONE_RE)) {
      const digits = m.value.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13 && !/^(19|20)\d{2}$/.test(digits.slice(0, 4))) {
        matches.push({ type: "phone", value: m.value.trim(), start: m.start, end: m.end });
      }
    }
  }

  if (opts.ipAddress) {
    for (const m of collectMatches(text, IPV4_RE)) matches.push({ type: "ip-address", value: m.value, start: m.start, end: m.end });
  }

  if (opts.url) {
    for (const m of collectMatches(text, URL_RE)) matches.push({ type: "url", value: m.value, start: m.start, end: m.end });
  }

  if (options.customRegexes) {
    for (const pattern of options.customRegexes) {
      if (!pattern.trim()) continue;
      if (pattern.length > 200) {
        throw new PaperZeroError("INVALID_INPUT", "Custom patterns must be 200 characters or fewer.");
      }
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, "g");
      } catch {
        throw new PaperZeroError("INVALID_INPUT", `Custom pattern "${pattern}" is not a valid regular expression.`);
      }
      for (const m of collectMatches(text, regex)) matches.push({ type: "custom", value: m.value, start: m.start, end: m.end });
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}
