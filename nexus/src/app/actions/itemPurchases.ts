'use server';

import { revalidatePath } from 'next/cache';
import { getCategories } from '@/app/actions/categories';
import { getItemNames } from '@/app/actions/itemNames';
import { getPackagingItemCombos } from '@/app/actions/orders';
import { requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import {
  Category,
  ItemName,
  LinkedPurchaseTargets,
  PackagingItemCombo,
  ProductLine,
  PurchaseReferenceData,
  PurchaseVersionTarget,
} from '@/types/database';

const PURCHASE_TARGET_SELECT = `
  id,
  item_name_id,
  category_id,
  product_line_id,
  version,
  status,
  updated_at,
  bc_item_id,
  item_name:item_names(*),
  category:categories(*),
  product_line:product_lines(*)
`;

interface PurchaseTargetRow {
  id: string;
  item_name_id: string;
  category_id: string | null;
  product_line_id: string | null;
  version: string | null;
  status: PurchaseVersionTarget['status'];
  updated_at: string;
  bc_item_id: string | null;
  item_name: ItemName;
  category: Category | null;
  product_line: ProductLine | null;
}

function ensureCanManagePurchases(access: { canManageCatalog: boolean }) {
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage purchase item links');
  }
}

function normalizeVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    throw new Error('Version is required');
  }
  return trimmed;
}

function naturalTargetSort(a: PurchaseVersionTarget, b: PurchaseVersionTarget) {
  if (a.version === null && b.version !== null) return -1;
  if (a.version !== null && b.version === null) return 1;
  return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
}

function toPurchaseVersionTarget(row: PurchaseTargetRow): PurchaseVersionTarget | null {
  if (!row.category_id || !row.category) return null;
  return {
    itemId: row.id,
    itemNameId: row.item_name_id,
    categoryId: row.category_id,
    productLineId: row.product_line_id,
    version: row.version,
    label: row.version?.trim() || 'Unversioned',
    status: row.status,
    updatedAt: row.updated_at,
    itemName: row.item_name,
    category: row.category,
    productLine: row.product_line,
  };
}

function toLinkedTargets(
  businessCentralItemRowId: string,
  rows: PurchaseTargetRow[]
): LinkedPurchaseTargets {
  const targets = rows
    .map(toPurchaseVersionTarget)
    .filter((target): target is PurchaseVersionTarget => Boolean(target))
    .sort(naturalTargetSort);

  const first = targets[0] ?? null;
  const linkedCombo: PackagingItemCombo | null = first
    ? {
        id: `${first.itemNameId}|${first.categoryId}`,
        item_name_id: first.itemNameId,
        category_id: first.categoryId,
        item_name: first.itemName,
        category: first.category,
        latest_item_id: first.itemId,
        latest_version: first.version,
        business_central_item_id: businessCentralItemRowId,
      }
    : null;

  return {
    businessCentralItemRowId,
    linkedCombo,
    itemNameId: first?.itemNameId ?? null,
    categoryId: first?.categoryId ?? null,
    targets,
  };
}

async function verifyBusinessCentralItemInScope(
  businessCentralItemRowId: string,
  orgId: string,
  bcConnectionId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_central_items')
    .select('id')
    .eq('id', businessCentralItemRowId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (error || !data) {
    throw new Error('Business Central item not found in the active environment');
  }
}

async function getActiveComboRows(itemNameId: string, categoryId: string) {
  const { orgId, bcConnectionId } = await requireActiveBusinessCentralScope();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('items')
    .select(PURCHASE_TARGET_SELECT)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .eq('item_name_id', itemNameId)
    .eq('category_id', categoryId)
    .eq('archived', false)
    .order('version', { ascending: true, nullsFirst: true });

  if (error) throw error;
  return (data || []) as unknown as PurchaseTargetRow[];
}

async function assertComboNotLinkedToOther(
  itemNameId: string,
  categoryId: string,
  businessCentralItemRowId: string
) {
  const rows = await getActiveComboRows(itemNameId, categoryId);
  const conflicting = rows.find(
    (row) => row.bc_item_id && row.bc_item_id !== businessCentralItemRowId
  );
  if (conflicting) {
    throw new Error('Packaging item combination is already linked to another Business Central item');
  }
  return rows;
}

export async function getPurchaseReferenceData(): Promise<PurchaseReferenceData> {
  const [itemNames, categories, packagingItemCombos] = await Promise.all([
    getItemNames(),
    getCategories(),
    getPackagingItemCombos(),
  ]);

  return { itemNames, categories, packagingItemCombos };
}

export async function getLinkedPurchaseTargetsForBusinessCentralItem(
  businessCentralItemRowId: string
): Promise<LinkedPurchaseTargets> {
  const { orgId, bcConnectionId } = await requireActiveBusinessCentralScope();
  await verifyBusinessCentralItemInScope(businessCentralItemRowId, orgId, bcConnectionId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('items')
    .select(PURCHASE_TARGET_SELECT)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .eq('bc_item_id', businessCentralItemRowId)
    .eq('archived', false)
    .not('category_id', 'is', null)
    .order('version', { ascending: true, nullsFirst: true });

  if (error) throw error;
  return toLinkedTargets(businessCentralItemRowId, (data || []) as unknown as PurchaseTargetRow[]);
}

export async function linkBusinessCentralItemToPackagingCombo(input: {
  businessCentralItemRowId: string;
  itemNameId: string;
  categoryId: string;
}): Promise<LinkedPurchaseTargets> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  ensureCanManagePurchases(access);
  await verifyBusinessCentralItemInScope(input.businessCentralItemRowId, orgId, bcConnectionId);

  const supabase = await createClient();
  const { error } = await supabase.rpc('link_business_central_item_to_packaging_combo', {
    p_business_central_item_row_id: input.businessCentralItemRowId,
    p_item_name_id: input.itemNameId,
    p_category_id: input.categoryId,
  });

  if (error) throw error;

  revalidatePath('/items');
  revalidatePath('/orders');
  return getLinkedPurchaseTargetsForBusinessCentralItem(input.businessCentralItemRowId);
}

export async function createUnversionedPurchaseComboForBusinessCentralItem(input: {
  businessCentralItemRowId: string;
  itemNameId: string;
  categoryId: string;
}): Promise<LinkedPurchaseTargets> {
  const { orgId, bcConnectionId, user, access } = await requireActiveBusinessCentralScope();
  ensureCanManagePurchases(access);
  await verifyBusinessCentralItemInScope(input.businessCentralItemRowId, orgId, bcConnectionId);

  const existingRows = await getActiveComboRows(input.itemNameId, input.categoryId);
  if (existingRows.length > 0) {
    return linkBusinessCentralItemToPackagingCombo(input);
  }

  await assertComboNotLinkedToOther(input.itemNameId, input.categoryId, input.businessCentralItemRowId);

  const supabase = await createClient();
  const { error } = await supabase
    .from('items')
    .insert({
      item_name_id: input.itemNameId,
      category_id: input.categoryId,
      version: null,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
      bc_item_id: input.businessCentralItemRowId,
      created_by: user.id,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Packaging item combination already exists');
    }
    throw error;
  }

  revalidatePath('/items');
  revalidatePath('/orders');
  return getLinkedPurchaseTargetsForBusinessCentralItem(input.businessCentralItemRowId);
}

export async function createPurchaseVersionTargetForBusinessCentralItem(input: {
  businessCentralItemRowId: string;
  itemNameId: string;
  categoryId: string;
  version: string;
}): Promise<PurchaseVersionTarget> {
  const version = normalizeVersion(input.version);
  const { orgId, bcConnectionId, user, access } = await requireActiveBusinessCentralScope();
  ensureCanManagePurchases(access);
  await verifyBusinessCentralItemInScope(input.businessCentralItemRowId, orgId, bcConnectionId);
  await assertComboNotLinkedToOther(input.itemNameId, input.categoryId, input.businessCentralItemRowId);

  const supabase = await createClient();
  const { data: duplicate, error: duplicateError } = await supabase
    .from('items')
    .select('id')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .eq('item_name_id', input.itemNameId)
    .eq('category_id', input.categoryId)
    .eq('version', version)
    .eq('archived', false)
    .maybeSingle();

  if (duplicateError) throw duplicateError;
  if (duplicate) {
    throw new Error(`Version ${version} already exists for this purchase item`);
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      item_name_id: input.itemNameId,
      category_id: input.categoryId,
      version,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
      bc_item_id: input.businessCentralItemRowId,
      created_by: user.id,
    })
    .select(PURCHASE_TARGET_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Version ${version} already exists for this purchase item`);
    }
    throw error;
  }

  await linkBusinessCentralItemToPackagingCombo({
    businessCentralItemRowId: input.businessCentralItemRowId,
    itemNameId: input.itemNameId,
    categoryId: input.categoryId,
  });

  const target = toPurchaseVersionTarget(data as unknown as PurchaseTargetRow);
  if (!target) {
    throw new Error('Created purchase version target is missing item/category data');
  }

  revalidatePath('/items');
  revalidatePath('/orders');
  return target;
}
