'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import type { ItemTemplate } from '@/types/database';

export interface ItemTemplateInput {
  name: string;
  description?: string | null;
  categoryId?: string | null;
  bcItemCategoryCode?: string | null;
  defaultType?: string;
  baseUnitOfMeasureCode?: string | null;
  taxGroupCode?: string | null;
  generalProductPostingGroupCode?: string | null;
  inventoryPostingGroupCode?: string | null;
  priceIncludesTax?: boolean;
  blocked?: boolean;
  isActive?: boolean;
}

function toRow(input: ItemTemplateInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    category_id: input.categoryId ?? null,
    bc_item_category_code: input.bcItemCategoryCode ?? null,
    default_type: input.defaultType ?? 'Inventory',
    base_unit_of_measure_code: input.baseUnitOfMeasureCode ?? null,
    tax_group_code: input.taxGroupCode ?? null,
    general_product_posting_group_code: input.generalProductPostingGroupCode ?? null,
    inventory_posting_group_code: input.inventoryPostingGroupCode ?? null,
    price_includes_tax: input.priceIncludesTax ?? false,
    blocked: input.blocked ?? false,
    is_active: input.isActive ?? true,
  };
}

export async function listItemTemplates(): Promise<ItemTemplate[]> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .select('*')
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as ItemTemplate[];
}

export async function createItemTemplate(input: ItemTemplateInput): Promise<ItemTemplate> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .insert({
      ...toRow(input),
      organization_id: scope.orgId,
      bc_connection_id: scope.bcConnectionId,
      created_by: scope.user.id,
      updated_by: scope.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  revalidatePath('/items');
  return data as ItemTemplate;
}

export async function updateItemTemplate(id: string, input: ItemTemplateInput): Promise<ItemTemplate> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .update({ ...toRow(input), updated_by: scope.user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId)
    .select('*')
    .single();
  if (error) throw error;
  revalidatePath('/items');
  return data as ItemTemplate;
}

export async function deleteItemTemplate(id: string): Promise<void> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('item_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId);
  if (error) throw error;
  revalidatePath('/items');
}
