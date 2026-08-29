import type { NoSeriesClient } from './noSeriesClient';
import { SeriesNotFoundError, SeriesNotNormalError } from './numberAssigner';

/**
 * Blank means manual numbering, so it normalizes to null rather than ''.
 * BC series codes are uppercase, so we uppercase to avoid a code that looks
 * correct to the admin but does not match on lookup.
 */
export function normalizeSeriesCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/**
 * Confirms a series exists in Business Central and is Normal (Allow Gaps off).
 *
 * Item creation already refuses anything else — see numberAssigner — but it
 * does so at item-creation time, which puts the error in front of whoever
 * happens to be creating an item rather than the admin who configured it.
 * Validating on save moves the failure to the person who can fix it.
 *
 * Returns the normalized code, or null when blank (manual numbering).
 */
export async function validateSeriesCode(
  noSeries: NoSeriesClient,
  raw: string | null | undefined
): Promise<string | null> {
  const code = normalizeSeriesCode(raw);
  if (!code) return null;

  const line = await noSeries.getOpenLine(code);
  if (!line) throw new SeriesNotFoundError(code);
  if (line.implementation !== 'Normal') throw new SeriesNotNormalError(code);

  return code;
}
