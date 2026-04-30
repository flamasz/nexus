export const GRAMS_PER_OUNCE = 28.349523125;

export function gramsToOunces(grams: number | null | undefined): number | null {
  if (grams === null || grams === undefined) return null;
  if (!Number.isFinite(grams)) return null;
  if (grams < 0) return null;
  return Math.round((grams / GRAMS_PER_OUNCE) * 10) / 10;
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function unitsPerPallet(
  unitsPerCase: number | null | undefined,
  casesPerLayer: number | null | undefined,
  layersPerPallet: number | null | undefined
): number | null {
  if (
    !isPositiveInteger(unitsPerCase) ||
    !isPositiveInteger(casesPerLayer) ||
    !isPositiveInteger(layersPerPallet)
  ) {
    return null;
  }
  return unitsPerCase * casesPerLayer * layersPerPallet;
}
