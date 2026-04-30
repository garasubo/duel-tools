import type { DetectionResult } from './types';

export const NORMAL_OCR_INTERVAL_MS = 700;
export const FAST_OCR_INTERVAL_MS = 250;
export const REQUIRED_CONSECUTIVE = 3;
export const HIGH_CONFIDENCE_THRESHOLD = 85;
export const HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE = 2;

export function getOcrInterval(hasCandidate: boolean): number {
  return hasCandidate ? FAST_OCR_INTERVAL_MS : NORMAL_OCR_INTERVAL_MS;
}

export function getRequiredConsecutive(confidence: number): number {
  return confidence >= HIGH_CONFIDENCE_THRESHOLD
    ? HIGH_CONFIDENCE_REQUIRED_CONSECUTIVE
    : REQUIRED_CONSECUTIVE;
}

export function averageConfidence(results: DetectionResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, item) => sum + item.confidence, 0) / results.length;
}
