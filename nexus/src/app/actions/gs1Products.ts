'use server';

import { revalidatePath } from 'next/cache';

import { requirePermission } from '@/lib/auth/currentUserAccess';
import { parseGs1Excel } from '@/lib/gs1/parser';
import { matchGs1RowToBcItems } from '@/lib/gs1/matcher';
import { createServiceClient } from '@/lib/supabase/server';
import type {
  Gs1ImportBatch,
  Gs1ImportMatchCandidate,
  Gs1ImportResult,
  Gs1MatchMethod,
  Gs1Product,
  Gs1ReviewRow,
} from '@/types/gs1';

type Client = ReturnType<typeof createServiceClient>;

// ── Row mappers ──────────────────────────────────────────────────────────────

function mapBatchRow(r: Record<string, unknown>): Gs1ImportBatch {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    uploadedBy: (r.uploaded_by as string) ?? null,
    fileName: r.file_name as string,
    fileSizeBytes: (r.file_size_bytes as number) ?? null,
    sourceSheet: (r.source_sheet as string) ?? null,
    status: r.status as Gs1ImportBatch['status'],
    totalRows: (r.total_rows as number) ?? 0,
    createdCount: (r.created_count as number) ?? 0,
    updatedCount: (r.updated_count as number) ?? 0,
    duplicateCount: (r.duplicate_count as number) ?? 0,
    autoLinkedCount: (r.auto_linked_count as number) ?? 0,
    suggestedCount: (r.suggested_count as number) ?? 0,
    errorCount: (r.error_count as number) ?? 0,
    errorMessage: (r.error_message as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapProductRow(r: Record<string, unknown>): Gs1Product {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    normalizedGtin: r.normalized_gtin as string,
    gtin: (r.gtin as string) ?? null,
    gtin8: (r.gtin_8 as string) ?? null,
    gtin12Upc: (r.gtin_12_upc as string) ?? null,
    gtin13Ean: (r.gtin_13_ean as string) ?? null,
    gs1CompanyPrefix: (r.gs1_company_prefix as string) ?? null,
    brandName: (r.brand_name as string) ?? null,
    productDescription: (r.product_description as string) ?? null,
    productDescriptionShort: (r.product_description_short as string) ?? null,
    labelDescription: (r.label_description as string) ?? null,
    productIndustry: (r.product_industry as string) ?? null,
    packagingLevel: (r.packaging_level as string) ?? null,
    statusLabel: (r.status_label as string) ?? null,
    sku: (r.sku as string) ?? null,
    gpcBrick: (r.gpc_brick as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    targetMarkets: (r.target_markets as string) ?? null,
    netWeightNumeric: (r.net_weight_numeric as number) ?? null,
    netWeightUnit: (r.net_weight_unit as string) ?? null,
    grossWeightNumeric: (r.gross_weight_numeric as number) ?? null,
    grossWeightUnit: (r.gross_weight_unit as string) ?? null,
    depthNumeric: (r.depth_numeric as number) ?? null,
    depthUnit: (r.depth_unit as string) ?? null,
    widthNumeric: (r.width_numeric as number) ?? null,
    widthUnit: (r.width_unit as string) ?? null,
    heightNumeric: (r.height_numeric as number) ?? null,
    heightUnit: (r.height_unit as string) ?? null,
    rawPayload: (r.raw_payload as Record<string, unknown>) ?? {},
    lastImportBatchId: (r.last_import_batch_id as string) ?? null,
    firstImportedAt: r.first_imported_at as string,
    lastImportedAt: r.last_imported_at as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapCandidateRow(r: Record<string, unknown>): Gs1ImportMatchCandidate {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    importBatchId: r.import_batch_id as string,
    gs1ProductId: r.gs1_product_id as string,
    businessCentralItemId: r.business_central_item_id as string,
    matchScore: r.match_score as number,
    matchMethod: r.match_method as Gs1MatchMethod,
    matchReason: (r.match_reason as string) ?? null,
    status: r.status as Gs1ImportMatchCandidate['status'],
    decidedBy: (r.decided_by as string) ?? null,
    decidedAt: (r.decided_at as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ── Import ───────────────────────────────────────────────────────────────────

export async function importGs1Excel(
  formData: FormData,
): Promise<Gs1ImportResult> {
  const { user, orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Only catalog managers can import GS1 data.',
  );

  const file = formData.get('file') as File | null;
  if (!file) throw new Error('No file provided.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Only .xlsx files from GS1 Data Hub are supported.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const parseResult = parseGs1Excel(buffer);

  if (parseResult.validationErrors.length > 0) {
    throw new Error(parseResult.validationErrors.join(' | '));
  }

  const db = createServiceClient();

  // Create the import batch record
  const { data: batchRow, error: batchErr } = await db
    .from('gs1_import_batches')
    .insert({
      organization_id: orgId,
      uploaded_by: user.id,
      file_name: file.name,
      file_size_bytes: file.size,
      source_sheet: parseResult.sheetName,
      status: 'parsed',
      total_rows: parseResult.rows.length + parseResult.skippedCount,
    })
    .select()
    .single();

  if (batchErr || !batchRow) {
    throw new Error('Failed to create import batch.');
  }

  const batchId: string = batchRow.id;

  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  // Upsert GS1 products by normalized_gtin
  const savedProductIds: Map<string, string> = new Map(); // normalizedGtin → id

  for (const row of parseResult.rows) {
    try {
      const { data: existing } = await db
        .from('gs1_products')
        .select('id')
        .eq('organization_id', orgId)
        .eq('normalized_gtin', row.normalizedGtin)
        .maybeSingle();

      if (existing) {
        // Update existing product
        await db
          .from('gs1_products')
          .update({
            gtin: row.gtin,
            gtin_8: row.gtin8,
            gtin_12_upc: row.gtin12Upc,
            gtin_13_ean: row.gtin13Ean,
            gs1_company_prefix: row.gs1CompanyPrefix,
            brand_name: row.brandName,
            product_description: row.productDescription,
            product_description_short: row.productDescriptionShort,
            label_description: row.labelDescription,
            product_industry: row.productIndustry,
            packaging_level: row.packagingLevel,
            status_label: row.statusLabel,
            sku: row.sku,
            gpc_brick: row.gpcBrick,
            image_url: row.imageUrl,
            target_markets: row.targetMarkets,
            net_weight_numeric: row.netWeightNumeric,
            net_weight_unit: row.netWeightUnit,
            gross_weight_numeric: row.grossWeightNumeric,
            gross_weight_unit: row.grossWeightUnit,
            depth_numeric: row.depthNumeric,
            depth_unit: row.depthUnit,
            width_numeric: row.widthNumeric,
            width_unit: row.widthUnit,
            height_numeric: row.heightNumeric,
            height_unit: row.heightUnit,
            raw_payload: row.rawPayload,
            last_import_batch_id: batchId,
            last_imported_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        savedProductIds.set(row.normalizedGtin, existing.id);
        updatedCount++;
      } else {
        const { data: inserted } = await db
          .from('gs1_products')
          .insert({
            organization_id: orgId,
            normalized_gtin: row.normalizedGtin,
            gtin: row.gtin,
            gtin_8: row.gtin8,
            gtin_12_upc: row.gtin12Upc,
            gtin_13_ean: row.gtin13Ean,
            gs1_company_prefix: row.gs1CompanyPrefix,
            brand_name: row.brandName,
            product_description: row.productDescription,
            product_description_short: row.productDescriptionShort,
            label_description: row.labelDescription,
            product_industry: row.productIndustry,
            packaging_level: row.packagingLevel,
            status_label: row.statusLabel,
            sku: row.sku,
            gpc_brick: row.gpcBrick,
            image_url: row.imageUrl,
            target_markets: row.targetMarkets,
            net_weight_numeric: row.netWeightNumeric,
            net_weight_unit: row.netWeightUnit,
            gross_weight_numeric: row.grossWeightNumeric,
            gross_weight_unit: row.grossWeightUnit,
            depth_numeric: row.depthNumeric,
            depth_unit: row.depthUnit,
            width_numeric: row.widthNumeric,
            width_unit: row.widthUnit,
            height_numeric: row.heightNumeric,
            height_unit: row.heightUnit,
            raw_payload: row.rawPayload,
            last_import_batch_id: batchId,
          })
          .select('id')
          .single();

        if (inserted) {
          savedProductIds.set(row.normalizedGtin, inserted.id);
          createdCount++;
        }
      }
    } catch {
      errorCount++;
    }
  }

  // Fetch all BC items for matching
  const { data: bcItems } = await db
    .from('business_central_items')
    .select('id, bc_item_number, display_name, display_name_2, gtin')
    .eq('organization_id', orgId)
    .neq('sync_status', 'deleted_in_bc');

  const bcSlim = (bcItems ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    bcItemNumber: (b.bc_item_number as string) ?? null,
    displayName: b.display_name as string,
    displayName2: (b.display_name_2 as string) ?? null,
    gtin: (b.gtin as string) ?? null,
  }));

  let autoLinkedCount = 0;
  let suggestedCount = 0;

  // Run matching and persist candidates
  for (const row of parseResult.rows) {
    const gs1ProductId = savedProductIds.get(row.normalizedGtin);
    if (!gs1ProductId) continue;

    const candidates = matchGs1RowToBcItems(row, bcSlim);
    if (candidates.length === 0) continue;

    // Check if an existing approved/auto link exists for this product
    const { data: existingLink } = await db
      .from('gs1_item_links')
      .select('id, status')
      .eq('gs1_product_id', gs1ProductId)
      .in('status', ['auto_linked', 'approved'])
      .maybeSingle();

    for (const candidate of candidates) {
      const candidateStatus = candidate.autoLink ? 'auto_linked' : 'suggested';

      // Persist match candidate
      await db.from('gs1_import_match_candidates').upsert(
        {
          organization_id: orgId,
          import_batch_id: batchId,
          gs1_product_id: gs1ProductId,
          business_central_item_id: candidate.bcItemId,
          match_score: candidate.score,
          match_method: candidate.method,
          match_reason: candidate.reason,
          status: candidateStatus,
        },
        { onConflict: 'import_batch_id,gs1_product_id,business_central_item_id' },
      );

      // Only create/update the active link if no existing approved link
      if (candidate.autoLink && !existingLink) {
        await db.from('gs1_item_links').upsert(
          {
            organization_id: orgId,
            gs1_product_id: gs1ProductId,
            business_central_item_id: candidate.bcItemId,
            status: 'auto_linked',
            match_method: candidate.method,
            match_score: candidate.score,
            match_reason: candidate.reason,
          },
          { onConflict: 'gs1_product_id,business_central_item_id' },
        );
        autoLinkedCount++;
        break; // Only auto-link the top candidate
      }
    }

    const hasSuggestion = candidates.some(c => !c.autoLink);
    if (hasSuggestion && !existingLink) suggestedCount++;
  }

  // Update batch with final counts
  await db
    .from('gs1_import_batches')
    .update({
      created_count: createdCount,
      updated_count: updatedCount,
      duplicate_count: duplicateCount,
      auto_linked_count: autoLinkedCount,
      suggested_count: suggestedCount,
      error_count: errorCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  revalidatePath('/items');

  return {
    batchId,
    totalRows: parseResult.rows.length + parseResult.skippedCount,
    createdCount,
    updatedCount,
    duplicateCount,
    autoLinkedCount,
    suggestedCount,
    errorCount,
    errorMessage: null,
  };
}

// ── Fetch import review data ─────────────────────────────────────────────────

export async function getGs1ImportReview(batchId: string): Promise<{
  batch: Gs1ImportBatch;
  rows: Gs1ReviewRow[];
}> {
  const { orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Only catalog managers can view GS1 import reviews.',
  );

  const db = createServiceClient();

  const { data: batchRow, error: batchErr } = await db
    .from('gs1_import_batches')
    .select('*')
    .eq('id', batchId)
    .eq('organization_id', orgId)
    .single();

  if (batchErr || !batchRow) throw new Error('Import batch not found.');

  const { data: candidateRows } = await db
    .from('gs1_import_match_candidates')
    .select('*, gs1_products(*), business_central_items(id, bc_item_number, display_name, gtin)')
    .eq('import_batch_id', batchId)
    .eq('organization_id', orgId)
    .order('match_score', { ascending: false });

  const rows: Gs1ReviewRow[] = (candidateRows ?? []).map((c: Record<string, unknown>) => {
    const gs1 = c.gs1_products as Record<string, unknown>;
    const bc = c.business_central_items as Record<string, unknown>;
    return {
      candidate: mapCandidateRow(c),
      gs1Product: mapProductRow(gs1),
      bcItemId: bc.id as string,
      bcItemNumber: (bc.bc_item_number as string) ?? null,
      bcDisplayName: bc.display_name as string,
      bcGtin: (bc.gtin as string) ?? null,
    };
  });

  return { batch: mapBatchRow(batchRow as Record<string, unknown>), rows };
}

// ── Recent import batches ────────────────────────────────────────────────────

export async function getGs1ImportBatches(): Promise<Gs1ImportBatch[]> {
  const { orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Only catalog managers can view GS1 imports.',
  );

  const db = createServiceClient();
  const { data } = await db
    .from('gs1_import_batches')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map(r => mapBatchRow(r as Record<string, unknown>));
}

// ── Decision actions ─────────────────────────────────────────────────────────

export async function approveGs1Match(candidateId: string): Promise<void> {
  const { user, orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Only catalog managers can approve GS1 matches.',
  );

  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data: candidate } = await db
    .from('gs1_import_match_candidates')
    .select('*')
    .eq('id', candidateId)
    .eq('organization_id', orgId)
    .single();

  if (!candidate) throw new Error('Candidate not found.');

  await db
    .from('gs1_import_match_candidates')
    .update({ status: 'approved', decided_by: user.id, decided_at: now, updated_at: now })
    .eq('id', candidateId);

  // Upsert active link
  await db.from('gs1_item_links').upsert(
    {
      organization_id: orgId,
      gs1_product_id: candidate.gs1_product_id,
      business_central_item_id: candidate.business_central_item_id,
      status: 'approved',
      match_method: candidate.match_method,
      match_score: candidate.match_score,
      match_reason: candidate.match_reason,
      decided_by: user.id,
      decided_at: now,
    },
    { onConflict: 'gs1_product_id,business_central_item_id' },
  );

  // Supersede other candidates for the same GS1 product in this batch
  await db
    .from('gs1_import_match_candidates')
    .update({ status: 'superseded', updated_at: now })
    .eq('import_batch_id', candidate.import_batch_id)
    .eq('gs1_product_id', candidate.gs1_product_id)
    .neq('id', candidateId)
    .in('status', ['suggested', 'auto_linked']);

  revalidatePath('/items');
}

export async function denyGs1Match(candidateId: string): Promise<void> {
  const { user, orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Only catalog managers can deny GS1 matches.',
  );

  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data: candidate } = await db
    .from('gs1_import_match_candidates')
    .select('*')
    .eq('id', candidateId)
    .eq('organization_id', orgId)
    .single();

  if (!candidate) throw new Error('Candidate not found.');

  await db
    .from('gs1_import_match_candidates')
    .update({ status: 'denied', decided_by: user.id, decided_at: now, updated_at: now })
    .eq('id', candidateId);

  // Mark existing link as denied
  await db
    .from('gs1_item_links')
    .update({ status: 'denied', decided_by: user.id, decided_at: now, updated_at: now })
    .eq('gs1_product_id', candidate.gs1_product_id)
    .eq('business_central_item_id', candidate.business_central_item_id)
    .eq('organization_id', orgId);

  revalidatePath('/items');
}

export async function unlinkGs1Match(gs1ProductId: string, bcItemId: string): Promise<void> {
  const { user, orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Only catalog managers can unlink GS1 matches.',
  );

  const db = createServiceClient();
  const now = new Date().toISOString();

  await db
    .from('gs1_item_links')
    .update({ status: 'unlinked', decided_by: user.id, decided_at: now, updated_at: now })
    .eq('gs1_product_id', gs1ProductId)
    .eq('business_central_item_id', bcItemId)
    .eq('organization_id', orgId);

  revalidatePath('/items');
}

// ── Fetch linked GS1 product for item detail pane ────────────────────────────

export async function getLinkedGs1Product(bcItemId: string): Promise<{
  product: Gs1Product;
  link: { status: string; matchMethod: string; matchReason: string | null; matchScore: number | null };
} | null> {
  const { orgId } = await requirePermission(
    (a) => a.canManageCatalog,
    'Unauthorized.',
  );

  const db = createServiceClient();

  const { data } = await db
    .from('gs1_item_links')
    .select('*, gs1_products(*)')
    .eq('business_central_item_id', bcItemId)
    .eq('organization_id', orgId)
    .in('status', ['auto_linked', 'approved'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const product = mapProductRow(data.gs1_products as Record<string, unknown>);
  return {
    product,
    link: {
      status: data.status as string,
      matchMethod: data.match_method as string,
      matchReason: (data.match_reason as string) ?? null,
      matchScore: (data.match_score as number) ?? null,
    },
  };
}
