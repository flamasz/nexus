/** Minimum digits to be considered a GTIN-like sequence */
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * Strip all non-digit characters and return a canonical GTIN string.
 * Preserves leading zeroes. Returns null if the result has no digits.
 */
export function normalizeGtin(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits;
}

/**
 * Pad a GTIN to 14 digits for uniform comparison (GTIN-14 canonical form).
 */
export function padGtin14(gtin: string): string {
  return gtin.padStart(14, '0');
}

/**
 * Return true if two normalized GTINs refer to the same product.
 * Compares both raw and 14-digit-padded forms so GTIN-12 and GTIN-14 match.
 */
export function gtinsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return padGtin14(a) === padGtin14(b);
}

/**
 * Scan text for digit sequences that look like GTINs (8, 12, 13, or 14 digits).
 * Tolerates spaces/dashes/dots between digit groups.
 * Returns all candidate normalized GTINs found.
 */
export function extractGtinsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  // Remove common separators to find runs of digits
  const cleaned = text.replace(/[\s\-\.]/g, '');
  const results: string[] = [];
  // Find all maximal digit sequences
  const matches = cleaned.match(/\d+/g);
  if (!matches) return results;
  for (const m of matches) {
    if (GTIN_LENGTHS.has(m.length)) {
      results.push(m);
    }
  }
  return results;
}

/**
 * Normalize a product/item name for comparison:
 * - lowercase
 * - collapse whitespace
 * - remove common GS1 export separators (| / \ ; :)
 * - normalize ampersands to "and"
 * - strip leading/trailing punctuation
 */
export function normalizeName(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[|\/\\;:,\.!?'"()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a normalized name into tokens, filtering trivial words.
 */
export function tokenizeName(name: string): string[] {
  const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'for', 'and', 'or', 'with', 'by', 'at']);
  return name
    .split(' ')
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Compute a simple Jaccard similarity between two token sets.
 * Returns 0–1.
 */
export function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
