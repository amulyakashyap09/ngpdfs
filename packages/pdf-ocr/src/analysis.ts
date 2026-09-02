export const USEFUL_TEXT_THRESHOLD = 40;

export function shouldOcrPage(existingText: string, force = false): boolean {
  if (force) return true;
  return existingText.replace(/\s+/g, " ").trim().length < USEFUL_TEXT_THRESHOLD;
}
