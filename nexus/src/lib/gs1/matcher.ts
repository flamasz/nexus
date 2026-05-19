import {
  extractGtinsFromText,
  gtinsMatch,
  jaccardSimilarity,
  normalizeName,
  tokenizeName,
} from './normalize';
import type { Gs1ParsedRow } from './parser';
import type { Gs1MatchMethod } from '@/types/gs1';

/** Score thresholds from the PRD */
const SCORE_EXACT = 1.0;
const SCORE_HIGH_MIN = 0.88;
const SCORE_SUGGESTION_MIN = 0.72;

export interface MatchCandidate {
  bcItemId: string;
  bcItemNumber: string | null;
  bcDisplayName: string;
  bcGtin: string | null;
  score: number;
  method: Gs1MatchMethod;
  reason: string;
  /** true = auto-link; false = show as suggestion */
  autoLink: boolean;
}

interface BcItemSlim {
  id: string;
  bcItemNumber: string | null;
  displayName: string;
  displayName2: string | null;
  gtin: string | null;
}

/**
 * Score a single GS1 row against a single BC item.
 * Returns null if score is below SCORE_SUGGESTION_MIN.
 */
export function scoreGs1ItemMatch(
  gs1: Pick<Gs1ParsedRow, 'normalizedGtin' | 'gtin12Upc' | 'gtin13Ean' | 'gtin8' | 'productDescription' | 'productDescriptionShort' | 'labelDescription' | 'brandName'>,
  bc: BcItemSlim,
): MatchCandidate | null {
  // 1. Exact GTIN field match (BC item has gtin column set)
  if (bc.gtin) {
    const bcNorm = bc.gtin.replace(/\D/g, '');
    if (bcNorm && gtinsMatch(bcNorm, gs1.normalizedGtin)) {
      return {
        bcItemId: bc.id,
        bcItemNumber: bc.bcItemNumber,
        bcDisplayName: bc.displayName,
        bcGtin: bc.gtin,
        score: SCORE_EXACT,
        method: 'gtin_field',
        reason: `BC item GTIN field "${bc.gtin}" matches GS1 GTIN`,
        autoLink: true,
      };
    }
  }

  // 2. GTIN embedded in BC item name or number
  const nameTexts = [bc.displayName, bc.displayName2, bc.bcItemNumber].filter(Boolean) as string[];
  for (const text of nameTexts) {
    const embedded = extractGtinsFromText(text);
    for (const candidate of embedded) {
      if (gtinsMatch(candidate, gs1.normalizedGtin)) {
        return {
          bcItemId: bc.id,
          bcItemNumber: bc.bcItemNumber,
          bcDisplayName: bc.displayName,
          bcGtin: bc.gtin,
          score: SCORE_EXACT,
          method: 'gtin_in_name',
          reason: `GTIN ${gs1.normalizedGtin} found in "${text}"`,
          autoLink: true,
        };
      }
    }
  }

  // 3. Name-based matching
  const gs1Names = [
    gs1.productDescription,
    gs1.productDescriptionShort,
    gs1.labelDescription,
    gs1.brandName && gs1.productDescription
      ? `${gs1.brandName} ${gs1.productDescription}`
      : null,
  ].filter(Boolean) as string[];

  const bcNames = [bc.displayName, bc.displayName2].filter(Boolean) as string[];

  let bestScore = 0;
  let bestGs1Name = '';
  let bestBcName = '';

  for (const gs1Name of gs1Names) {
    const normGs1 = normalizeName(gs1Name);
    const tokGs1 = tokenizeName(normGs1);

    for (const bcName of bcNames) {
      const normBc = normalizeName(bcName);

      // Exact normalized name match
      if (normGs1 === normBc && normGs1.length > 0) {
        return {
          bcItemId: bc.id,
          bcItemNumber: bc.bcItemNumber,
          bcDisplayName: bc.displayName,
          bcGtin: bc.gtin,
          score: 0.97,
          method: 'exact_name',
          reason: `Exact name match: "${bc.displayName}"`,
          autoLink: true,
        };
      }

      const tokBc = tokenizeName(normBc);
      const sim = jaccardSimilarity(tokGs1, tokBc);
      if (sim > bestScore) {
        bestScore = sim;
        bestGs1Name = gs1Name;
        bestBcName = bcName;
      }
    }
  }

  if (bestScore >= SCORE_HIGH_MIN) {
    return {
      bcItemId: bc.id,
      bcItemNumber: bc.bcItemNumber,
      bcDisplayName: bc.displayName,
      bcGtin: bc.gtin,
      score: bestScore,
      method: 'high_similarity',
      reason: `High similarity (${Math.round(bestScore * 100)}%): "${bestBcName}" ≈ "${bestGs1Name}"`,
      autoLink: true,
    };
  }

  if (bestScore >= SCORE_SUGGESTION_MIN) {
    return {
      bcItemId: bc.id,
      bcItemNumber: bc.bcItemNumber,
      bcDisplayName: bc.displayName,
      bcGtin: bc.gtin,
      score: bestScore,
      method: 'suggested_similarity',
      reason: `Likely match (${Math.round(bestScore * 100)}%): "${bestBcName}" ≈ "${bestGs1Name}"`,
      autoLink: false,
    };
  }

  return null;
}

/**
 * Run matching for one GS1 row against all BC items.
 * Handles ambiguity: if multiple candidates have the same top auto-link score,
 * all are demoted to suggestions.
 */
export function matchGs1RowToBcItems(
  gs1: Gs1ParsedRow,
  bcItems: BcItemSlim[],
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const bc of bcItems) {
    const result = scoreGs1ItemMatch(gs1, bc);
    if (result) candidates.push(result);
  }

  if (candidates.length === 0) return [];

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  // Ambiguity guard: if top auto-link score is shared by multiple candidates, demote all to suggestions
  const topScore = candidates[0].score;
  const topAutoLinks = candidates.filter(c => c.autoLink && c.score === topScore);
  if (topAutoLinks.length > 1) {
    for (const c of topAutoLinks) {
      c.autoLink = false;
      c.method = 'suggested_similarity';
      c.reason = `Ambiguous: ${topAutoLinks.length} items scored equally (${Math.round(topScore * 100)}%) — manual review required`;
    }
  }

  return candidates;
}
