export const QUALITY_COST_MICROS = {
  low: 12_000,
  medium: 47_000,
  high: 128_000,
  auto: 47_000,
} as const;

export type PricedQuality = keyof typeof QUALITY_COST_MICROS;

export function estimatedCostMicros(quality: string): number {
  return QUALITY_COST_MICROS[quality as PricedQuality] ?? 0;
}
