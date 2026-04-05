'use server';

import { revalidatePath } from 'next/cache';
import { requireOrganizationContext, requirePermission } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';
import {
  ItemOrderStatus,
  ItemPriority,
  ItemStatus,
  OrderItem,
  OrderItemWithDetails,
  PurchaseOrder,
  PurchaseOrderWithItems,
} from '@/types/database';

async function verifyOrderBelongsToOrg(orderId: string, orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('id', orderId)
    .eq('organization_id', orgId)
    .single();

  if (!data) {
    throw new Error('Order not found or access denied');
  }
}

async function verifyOrderItemBelongsToOrg(itemId: string, orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('order_items')
    .select('id, order_id, purchase_orders!inner(organization_id)')
    .eq('id', itemId)
    .eq('purchase_orders.organization_id', orgId)
    .single();

  if (!data) {
    throw new Error('Order item not found or access denied');
  }
}

export async function getOrders(): Promise<PurchaseOrderWithItems[]> {
  const supabase = await createClient();
  let orgId: string;

  try {
    ({ orgId } = await requireOrganizationContext());
  } catch {
    return [];
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      order_items (
        *,
        item_name:item_names(*),
        category:categories(*)
      )
    `)
    .eq('organization_id', orgId)
    .order('order_sequence', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((order) => ({
    ...order,
    order_items: (order.order_items || []).sort(
      (a: OrderItem, b: OrderItem) => a.sort_order - b.sort_order
    ),
  })) as PurchaseOrderWithItems[];
}

export async function createOrder(): Promise<PurchaseOrder> {
  const { orgId, user } = await requirePermission(
    (access) => access.canCreateOrder,
    'You do not have permission to create purchase orders'
  );
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_organization_id: orgId,
    p_order_date: today,
    p_created_by: user.id,
  });

  if (error) {
    throw error;
  }

  revalidatePath('/orders');
  return data as PurchaseOrder;
}

export async function updateOrderDate(orderId: string, orderDate: string): Promise<void> {
  const { orgId } = await requirePermission(
    (access) => access.canEditOrderDate,
    'You do not have permission to change order dates'
  );
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId);

  const { error } = await supabase
    .from('purchase_orders')
    .update({ order_date: orderDate, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('organization_id', orgId);

  if (error) {
    throw error;
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { orgId } = await requirePermission(
    (access) => access.canDeleteOrders,
    'You do not have permission to delete orders'
  );
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId);

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', orderId)
    .eq('organization_id', orgId);

  if (error) {
    throw error;
  }

  revalidatePath('/orders');
}

export async function archiveOrder(orderId: string, archived: boolean): Promise<void> {
  const { orgId } = await requirePermission(
    (access) => access.canArchiveOrders,
    'You do not have permission to archive orders'
  );
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId);

  const { error } = await supabase
    .from('purchase_orders')
    .update({ archived, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('organization_id', orgId);

  if (error) {
    throw error;
  }

  revalidatePath('/orders');
}

export async function createOrderItem(orderId: string): Promise<OrderItemWithDetails> {
  const { orgId } = await requirePermission(
    (access) => access.canEditOrderItems,
    'You do not have permission to add order items'
  );
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId);

  const { data: existing } = await supabase
    .from('order_items')
    .select('sort_order')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('order_items')
    .insert({
      order_id: orderId,
      item_order_status: 'new',
      sort_order: nextSortOrder,
    })
    .select('*, item_name:item_names(*), category:categories(*)')
    .single();

  if (error) {
    throw error;
  }

  return data as OrderItemWithDetails;
}

export async function updateOrderItem(
  itemId: string,
  data: {
    item_name_id?: string | null;
    category_id?: string | null;
    version?: string | null;
    approval_status?: ItemStatus | null;
    notes?: string | null;
    order_qty?: number | null;
    item_order_status?: ItemOrderStatus;
    priority?: ItemPriority;
  }
): Promise<OrderItemWithDetails> {
  const { orgId, access } = await requireOrganizationContext();
  const requiresOrderEdit =
    'item_name_id' in data ||
    'category_id' in data ||
    'notes' in data ||
    'order_qty' in data ||
    'item_order_status' in data ||
    'priority' in data;
  const requiresDesignerEdit = 'version' in data || 'approval_status' in data;

  if (requiresOrderEdit && !access.canEditOrderItems) {
    throw new Error('You do not have permission to edit order items');
  }

  if (requiresDesignerEdit && !access.canEditDesignerFields) {
    throw new Error('You do not have permission to edit designer fields');
  }

  const supabase = await createClient();
  await verifyOrderItemBelongsToOrg(itemId, orgId);

  const { data: updated, error } = await supabase
    .from('order_items')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('*, item_name:item_names(*), category:categories(*)')
    .single();

  if (error) {
    throw error;
  }

  return updated as OrderItemWithDetails;
}

export async function deleteOrderItem(itemId: string): Promise<void> {
  const { orgId } = await requirePermission(
    (access) => access.canDeleteOrderItems,
    'You do not have permission to delete order items'
  );
  const supabase = await createClient();
  await verifyOrderItemBelongsToOrg(itemId, orgId);

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw error;
  }
}

export interface VersionWithStatus {
  version: string;
  status?: string;
}

export async function reorderOrderItems(
  items: { id: string; sort_order: number }[]
): Promise<void> {
  const { orgId } = await requirePermission(
    (access) => access.canEditOrderItems,
    'You do not have permission to reorder order items'
  );
  const supabase = await createClient();

  for (const item of items) {
    await verifyOrderItemBelongsToOrg(item.id, orgId);
    const { error } = await supabase
      .from('order_items')
      .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      throw error;
    }
  }
}

export async function getVersionsForItemCategory(
  itemNameId: string,
  categoryId: string
): Promise<VersionWithStatus[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const [itemsResult, orderItemsResult] = await Promise.all([
    supabase
      .from('items')
      .select('version, status')
      .eq('item_name_id', itemNameId)
      .eq('category_id', categoryId)
      .eq('organization_id', orgId)
      .not('version', 'is', null),
    supabase
      .from('order_items')
      .select('version, purchase_orders!inner(organization_id)')
      .eq('item_name_id', itemNameId)
      .eq('category_id', categoryId)
      .eq('purchase_orders.organization_id', orgId)
      .not('version', 'is', null),
  ]);

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (orderItemsResult.error) {
    throw orderItemsResult.error;
  }

  const versionMap = new Map<string, string | undefined>();
  for (const row of itemsResult.data || []) {
    versionMap.set(row.version as string, row.status as string);
  }

  for (const row of orderItemsResult.data || []) {
    const version = row.version as string;
    if (!versionMap.has(version)) {
      versionMap.set(version, undefined);
    }
  }

  return [...versionMap.entries()]
    .map(([version, status]) => ({ version, status }))
    .sort((a, b) => a.version.localeCompare(b.version));
}
