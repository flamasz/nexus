export type Gs1BatchStatus = 'parsed' | 'reviewed' | 'failed';

export type Gs1LinkStatus = 'auto_linked' | 'approved' | 'denied' | 'unlinked';

export type Gs1CandidateStatus = 'suggested' | 'auto_linked' | 'approved' | 'denied' | 'superseded';

export type Gs1MatchMethod =
  | 'gtin_in_name'
  | 'gtin_field'
  | 'exact_name'
  | 'high_similarity'
  | 'suggested_similarity'
  | 'manual';

export interface Gs1ImportBatch {
  id: string;
  organizationId: string;
  uploadedBy: string | null;
  fileName: string;
  fileSizeBytes: number | null;
  sourceSheet: string | null;
  status: Gs1BatchStatus;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  autoLinkedCount: number;
  suggestedCount: number;
  errorCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Gs1Product {
  id: string;
  organizationId: string;
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
  lastImportBatchId: string | null;
  firstImportedAt: string;
  lastImportedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Gs1ItemLink {
  id: string;
  organizationId: string;
  gs1ProductId: string;
  businessCentralItemId: string;
  status: Gs1LinkStatus;
  matchMethod: Gs1MatchMethod;
  matchScore: number | null;
  matchReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Gs1ImportMatchCandidate {
  id: string;
  organizationId: string;
  importBatchId: string;
  gs1ProductId: string;
  businessCentralItemId: string;
  matchScore: number;
  matchMethod: Gs1MatchMethod;
  matchReason: string | null;
  status: Gs1CandidateStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A candidate row enriched with product + BC item data for the review UI */
export interface Gs1ReviewRow {
  candidate: Gs1ImportMatchCandidate;
  gs1Product: Gs1Product;
  bcItemId: string;
  bcItemNumber: string | null;
  bcDisplayName: string;
  bcGtin: string | null;
}

/** Summary returned by importGs1Excel */
export interface Gs1ImportResult {
  batchId: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  autoLinkedCount: number;
  suggestedCount: number;
  errorCount: number;
  errorMessage: string | null;
}
