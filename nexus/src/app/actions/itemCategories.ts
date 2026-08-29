'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createNoSeriesClientForOrg } from '@/lib/businessCentral/noSeriesClient';
import { validateSeriesCode } from '@/lib/businessCentral/noSeriesValidation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Category, DimensionUnit, ItemTemplate } from '@/types/database';
import { CategoryTemplateInput, ItemCategoryRow } from '@/types/itemCategories';

async function requireManage() {
  const scope = await requireActiveBusinessCentralScope();
  if (!scope.access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }
  return scope;
}

export async function getItemCategoriesPageData(): Promise<{
  rows: ItemCategoryRow[];
  canManage: boolean;
}> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('name', { ascending: true });
  if (error) throw error;

  const categoryIds = (categories ?? []).map((c) => c.id);

  const { data: templates } = await supabase
    .from('item_templates')
    .select('*')
    .in('category_id', categoryIds.length ? categoryIds : ['']);

  const templateByCategory = new Map<string, ItemTemplate>();
  for (const t of (templates ?? []) as ItemTemplate[]) {
    if (t.category_id) templateByCategory.set(t.category_id, t);
  }

  return {
    rows: ((categories ?? []) as Category[]).map((category) => ({
      category,
      template: templateByCategory.get(category.id) ?? null,
    })),
    canManage: access.canManageCatalog,
  };
}

export async function getCategoryItemCount(categoryId: string): Promise<number> {
  const { orgId, bcConnectionId } = await requireActiveBusinessCentralScope();
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);
  if (error) throw error;

  return count ?? 0;
}

export async function saveCategorySettings(
  id: string,
  input: {
    name: string;
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: DimensionUnit;
    color: string | null;
  }
): Promise<Category> {
  const { orgId, bcConnectionId } = await requireManage();
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .update({
      name,
      width: input.width,
      height: input.height,
      depth: input.depth,
      unit: input.unit,
      color: input.color || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as Category;
}

export async function saveCategoryNumbering(
  id: string,
  input: { bcNoSeriesCode: string | null }
): Promise<Category> {
  const { orgId, bcConnectionId } = await requireManage();

  // Validated against BC BEFORE persisting, so an invalid or gap-allowing
  // series is never stored. Throws SeriesNotFoundError / SeriesNotNormalError,
  // both of which carry admin-readable messages.
  const noSeries = await createNoSeriesClientForOrg(orgId, bcConnectionId);
  const code = await validateSeriesCode(noSeries, input.bcNoSeriesCode);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .update({ bc_no_series_code: code, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as Category;
}

export async function saveCategoryTemplate(
  categoryId: string,
  input: CategoryTemplateInput
): Promise<ItemTemplate> {
  const { orgId, bcConnectionId } = await requireManage();
  const supabase = await createClient();

  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('id', categoryId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();
  if (catError) throw catError;

  // item_templates (migration 039) has RLS enabled with a SELECT-only policy —
  // by design there is no INSERT/UPDATE policy, since writes were always
  // intended to go through service-role server actions. The RLS-checked
  // category lookup above (filtered on organization_id AND bc_connection_id)
  // is what authorises this write, so it's safe to use the service-role
  // client here. Do not swap this back to createClient() — that would just
  // hit 42501 (insufficient_privilege) again.
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('item_templates')
    .upsert(
      {
        organization_id: orgId,
        bc_connection_id: bcConnectionId,
        // One template per category, so the template's name is derived rather
        // than separately editable — there is nothing to disambiguate.
        name: (category as { name: string }).name,
        category_id: categoryId,
        bc_item_category_code: input.bcItemCategoryCode,
        default_type: input.defaultType,
        base_unit_of_measure_code: input.baseUnitOfMeasureCode,
        tax_group_code: input.taxGroupCode,
        general_product_posting_group_code: input.generalProductPostingGroupCode,
        inventory_posting_group_code: input.inventoryPostingGroupCode,
        price_includes_tax: input.priceIncludesTax,
        blocked: input.blocked,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category_id' }
    )
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as ItemTemplate;
}

export async function createItemCategory(name: string): Promise<Category> {
  const { orgId, bcConnectionId } = await requireManage();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: trimmed,
      unit: 'mm' as DimensionUnit,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
    })
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as Category;
}

export async function deleteItemCategory(id: string): Promise<void> {
  const { orgId, bcConnectionId } = await requireManage();
  const supabase = await createClient();

  // Detach rather than refuse: migration 005 ("Make category_id nullable to
  // allow category deletion") and the ON DELETE SET NULL foreign keys make
  // this the intended behaviour. The UI confirms the affected item count first.
  const { error: detachError } = await supabase
    .from('items')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);
  if (detachError) throw detachError;

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);
  if (error) throw error;

  revalidatePath('/item-categories');
}
