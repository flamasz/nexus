import * as XLSX from 'xlsx';
import { normalizeGtin } from './normalize';

export interface Gs1ParsedRow {
  /** Normalized GTIN (digits only) — required; row is skipped if absent */
  normalizedGtin: string;
  gtin: string | null;
  gtin8: string | null;
  gtin12Upc: string | null;
  gtin13Ean: string | null;
  gs1CompanyPrefix: string | null;
  brandName: string | null;
  productDescription: string | null;
  productDescriptionShort: string | null;
  labelDescription: string | null;
  productIndustry: string | null;
  packagingLevel: string | null;
  statusLabel: string | null;
  sku: string | null;
  gpcBrick: string | null;
  imageUrl: string | null;
  targetMarkets: string | null;
  netWeightNumeric: number | null;
  netWeightUnit: string | null;
  grossWeightNumeric: number | null;
  grossWeightUnit: string | null;
  depthNumeric: number | null;
  depthUnit: string | null;
  widthNumeric: number | null;
  widthUnit: string | null;
  heightNumeric: number | null;
  heightUnit: string | null;
  rawPayload: Record<string, unknown>;
}

export interface Gs1ParseResult {
  rows: Gs1ParsedRow[];
  skippedCount: number;
  sheetName: string;
  validationErrors: string[];
}

const EXPECTED_REQUIRED_HEADERS = ['GTIN', 'Product Description'];
const SHEET_NAME = 'ExportAllProducts';

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v).trim() || null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Parse a numeric-and-unit cell that may look like "1.5 kg" or just "1.5" */
function parseNumericUnit(raw: unknown): { value: number | null; unit: string | null } {
  const s = str(raw);
  if (!s) return { value: null, unit: null };
  const match = s.match(/^([\d.]+)\s*([a-zA-Z]*)$/);
  if (match) {
    return {
      value: parseFloat(match[1]) || null,
      unit: match[2] || null,
    };
  }
  const n = parseFloat(s);
  return { value: isNaN(n) ? null : n, unit: null };
}

export function parseGs1Excel(buffer: Buffer): Gs1ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Find the GS1 export sheet
  let sheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().replace(/\s/g, '') === SHEET_NAME.toLowerCase().replace(/\s/g, ''),
  );
  if (!sheetName) {
    // Fall back to first sheet
    sheetName = workbook.SheetNames[0];
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return {
      rows: [],
      skippedCount: 0,
      sheetName: sheetName ?? '',
      validationErrors: ['No worksheet found in uploaded file.'],
    };
  }

  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
  });

  if (raw.length === 0) {
    return {
      rows: [],
      skippedCount: 0,
      sheetName,
      validationErrors: ['Worksheet is empty.'],
    };
  }

  const validationErrors: string[] = [];
  const headers = Object.keys(raw[0]);
  for (const required of EXPECTED_REQUIRED_HEADERS) {
    if (!headers.some((h) => h.trim().toLowerCase() === required.toLowerCase())) {
      validationErrors.push(`Missing required column: "${required}"`);
    }
  }
  if (validationErrors.length > 0) {
    return { rows: [], skippedCount: 0, sheetName, validationErrors };
  }

  const rows: Gs1ParsedRow[] = [];
  let skippedCount = 0;

  for (const record of raw) {
    const rawGtin = str(record['GTIN'] ?? record['gtin']);
    const normalized = normalizeGtin(rawGtin);
    if (!normalized) {
      skippedCount++;
      continue;
    }

    const netW = parseNumericUnit(record['Net Weight'] ?? record['Net Weight (g)']);
    const grossW = parseNumericUnit(record['Gross Weight'] ?? record['Gross Weight (g)']);
    const depth = parseNumericUnit(record['Depth'] ?? record['Depth (in)']);
    const width = parseNumericUnit(record['Width'] ?? record['Width (in)']);
    const height = parseNumericUnit(record['Height'] ?? record['Height (in)']);

    rows.push({
      normalizedGtin: normalized,
      gtin: str(record['GTIN']),
      gtin8: str(record['GTIN-8']),
      gtin12Upc: str(record['GTIN-12 (U.P.C.)'] ?? record['GTIN-12']),
      gtin13Ean: str(record['GTIN-13 (EAN)'] ?? record['GTIN-13']),
      gs1CompanyPrefix: str(record['GS1 Company Prefix']),
      brandName: str(record['Brand Name']),
      productDescription: str(record['Product Description']),
      productDescriptionShort: str(record['Product Description-Short'] ?? record['Product Description Short']),
      labelDescription: str(record['Label Description']),
      productIndustry: str(record['Product Industry']),
      packagingLevel: str(record['Packaging Level']),
      statusLabel: str(record['Status Label'] ?? record['Status']),
      sku: str(record['SKU']),
      gpcBrick: str(record['GPC Brick'] ?? record['GPC Brick Description']),
      imageUrl: str(record['Image URL'] ?? record['Product Image URL']),
      targetMarkets: str(record['Target Markets']),
      netWeightNumeric: netW.value,
      netWeightUnit: netW.unit,
      grossWeightNumeric: grossW.value,
      grossWeightUnit: grossW.unit,
      depthNumeric: depth.value,
      depthUnit: depth.unit,
      widthNumeric: width.value,
      widthUnit: width.unit,
      heightNumeric: height.value,
      heightUnit: height.unit,
      rawPayload: record as Record<string, unknown>,
    });
  }

  return { rows, skippedCount, sheetName, validationErrors: [] };
}
