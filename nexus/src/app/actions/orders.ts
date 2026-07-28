'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusinessCentralScope, requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import {
  ItemOrderStatus,
  ItemPriority,
  ItemStatus,
  OrderItem,
  OrderItemWithDetails,
  PackagingItemCombo,
  PurchaseOrder,
  PurchaseOrderWithItems,
} from '@/types/database';
import { applyOrderItemQuantityDefaults, type QuantityPatch } from '@/lib/orderItemQuantityDefaults';


const ORDER_ITEM_SELECT = `
  *,
  item_name:item_names(*),
  category:categories(*)
`;

async function verifyOrderBelongsToOrg(orderId: string, orgId: string, bcConnectionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('id', orderId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (!data) {
    throw new Error('Order not found or access denied');
  }
}

async function verifyOrderItemBelongsToOrg(itemId: string, orgId: string, bcConnectionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('order_items')
    .select('id, order_id, purchase_orders!inner(organization_id, bc_connection_id)')
    .eq('id', itemId)
    .eq('purchase_orders.organization_id', orgId)
    .eq('purchase_orders.bc_connection_id', bcConnectionId)
    .single();

  if (!data) {
    throw new Error('Order item not found or access denied');
  }
}

export async function getOrders(): Promise<PurchaseOrderWithItems[]> {
  const supabase = await createClient();
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

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
    .eq('bc_connection_id', bcConnectionId)
    .order('order_sequence', { ascending: false });

  if (error) {
    throw error;
  }

  const orders = (data || []).map((order) => ({
    ...order,
    order_items: (order.order_items || []).sort(
      (a: OrderItem, b: OrderItem) => a.sort_order - b.sort_order
    ),
  })) as PurchaseOrderWithItems[];

  const orderItems = orders.flatMap((order) => order.order_items);
  const hasArtworkLookups = orderItems.some((item) => item.item_name_id && item.category_id);

  if (!hasArtworkLookups) {
    return orders;
  }

  const { data: artworkItems, error: artworkItemsError } = await supabase
    .from('items')
    .select('item_name_id, category_id, version, status, archived, updated_at')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('archived', { ascending: true })
    .order('updated_at', { ascending: false });

  if (artworkItemsError) {
    throw artworkItemsError;
  }

  const statusByArtworkKey = new Map<string, ItemStatus>();

  for (const item of (artworkItems || []) as {
    item_name_id: string;
    category_id: string | null;
    version: string | null;
    status: ItemStatus;
  }[]) {
    if (!item.category_id) {
      continue;
    }

    const key = `${item.item_name_id}|${item.category_id}|${item.version ?? ''}`;
    if (!statusByArtworkKey.has(key)) {
      statusByArtworkKey.set(key, item.status);
    }
  }

  return orders.map((order) => ({
    ...order,
    order_items: order.order_items.map((item) => {
      if (!item.item_name_id || !item.category_id) {
        return item;
      }

      const key = `${item.item_name_id}|${item.category_id}|${item.version ?? ''}`;
      const artworkStatus = statusByArtworkKey.get(key);

      return artworkStatus ? { ...item, approval_status: artworkStatus } : item;
    }),
  }));
}

export async function createOrder(): Promise<PurchaseOrder> {
  const { orgId, bcConnectionId, user, access } = await requireActiveBusinessCentralScope();
  if (!access.canCreateOrder) {
    throw new Error('You do not have permission to create purchase orders');
  }
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase.rpc('create_environment_purchase_order', {
    p_organization_id: orgId,
    p_bc_connection_id: bcConnectionId,
    p_order_date: today,
    p_created_by: user.id,
  });

  if (error || !data) {
    throw error ?? new Error('Failed to create purchase order');
  }

  revalidatePath('/orders');
  return data as PurchaseOrder;
}

export async function updateOrderDate(orderId: string, orderDate: string): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canEditOrderDate) {
    throw new Error('You do not have permission to change order dates');
  }
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId, bcConnectionId);

  const { error } = await supabase
    .from('purchase_orders')
    .update({ order_date: orderDate, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) {
    throw error;
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canDeleteOrders) {
    throw new Error('You do not have permission to delete orders');
  }
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId, bcConnectionId);

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', orderId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) {
    throw error;
  }

  revalidatePath('/orders');
}

export async function archiveOrder(orderId: string, archived: boolean): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canArchiveOrders) {
    throw new Error('You do not have permission to archive orders');
  }
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId, bcConnectionId);

  const { error } = await supabase
    .from('purchase_orders')
    .update({ archived, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) {
    throw error;
  }

  revalidatePath('/orders');
}

export async function getPackagingItemCombos(): Promise<PackagingItemCombo[]> {
  const supabase = await createClient();
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

  const { data, error } = await supabase
    .from('items')
    .select('id, item_name_id, category_id, version, bc_item_id, updated_at, item_name:item_names(*), category:categories(*)')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .eq('archived', false)
    .not('category_id', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const combos = new Map<string, PackagingItemCombo>();

  for (const row of (data || []) as unknown as Array<{
    id: string;
    item_name_id: string;
    category_id: string | null;
    version: string | null;
    bc_item_id: string | null;
    item_name: PackagingItemCombo['item_name'];
    category: PackagingItemCombo['category'] | null;
  }>) {
    if (!row.category_id || !row.category) continue;
    const key = `${row.item_name_id}|${row.category_id}`;
    if (!combos.has(key)) {
      combos.set(key, {
        id: key,
        item_name_id: row.item_name_id,
        category_id: row.category_id,
        item_name: row.item_name,
        category: row.category,
        latest_item_id: row.id,
        latest_version: row.version,
        business_central_item_id: row.bc_item_id,
      });
    }
  }

  return [...combos.values()].sort((a, b) =>
    `${a.item_name?.name ?? ''} ${a.category?.name ?? ''}`.localeCompare(`${b.item_name?.name ?? ''} ${b.category?.name ?? ''}`)
  );
}

export async function createOrderItem(orderId: string): Promise<OrderItemWithDetails> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canEditOrderItems) {
    throw new Error('You do not have permission to add order items');
  }
  const supabase = await createClient();
  await verifyOrderBelongsToOrg(orderId, orgId, bcConnectionId);

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
    .select(ORDER_ITEM_SELECT)
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
    overrun_qty?: number | null;
    accept_qty?: number | null;
    supplier_inv_qty?: number | null;
    manufacturer_inv_qty?: number | null;
    overrun_accepted?: boolean;
    overrun_qty_manual?: boolean;
    accept_qty_manual?: boolean;
    supplier_inv_qty_manual?: boolean;
    manufacturer_inv_qty_manual?: boolean;
    item_order_status?: ItemOrderStatus;
    priority?: ItemPriority;
  }
): Promise<OrderItemWithDetails> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  const requiresOrderEdit =
    'item_name_id' in data ||
    'category_id' in data ||
    'notes' in data ||
    'order_qty' in data ||
    'overrun_qty' in data ||
    'accept_qty' in data ||
    'supplier_inv_qty' in data ||
    'manufacturer_inv_qty' in data ||
    'overrun_accepted' in data ||
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
  await verifyOrderItemBelongsToOrg(itemId, orgId, bcConnectionId);

  const { data: current, error: currentError } = await supabase
    .from('order_items')
    .select(`
      order_qty,
      overrun_qty,
      accept_qty,
      supplier_inv_qty,
      manufacturer_inv_qty,
      overrun_qty_manual,
      accept_qty_manual,
      supplier_inv_qty_manual,
      manufacturer_inv_qty_manual
    `)
    .eq('id', itemId)
    .single();

  if (currentError || !current) {
    throw currentError ?? new Error('Order item not found');
  }

  const quantityPatchInput: QuantityPatch = {};
  if ('order_qty' in data) quantityPatchInput.order_qty = data.order_qty;
  if ('overrun_qty' in data) quantityPatchInput.overrun_qty = data.overrun_qty;
  if ('accept_qty' in data) quantityPatchInput.accept_qty = data.accept_qty;
  if ('supplier_inv_qty' in data) quantityPatchInput.supplier_inv_qty = data.supplier_inv_qty;
  if ('manufacturer_inv_qty' in data) quantityPatchInput.manufacturer_inv_qty = data.manufacturer_inv_qty;
  if ('overrun_qty_manual' in data) quantityPatchInput.overrun_qty_manual = data.overrun_qty_manual;
  if ('accept_qty_manual' in data) quantityPatchInput.accept_qty_manual = data.accept_qty_manual;
  if ('supplier_inv_qty_manual' in data) {
    quantityPatchInput.supplier_inv_qty_manual = data.supplier_inv_qty_manual;
  }
  if ('manufacturer_inv_qty_manual' in data) {
    quantityPatchInput.manufacturer_inv_qty_manual = data.manufacturer_inv_qty_manual;
  }

  const quantityPatch =
    Object.keys(quantityPatchInput).length > 0
      ? applyOrderItemQuantityDefaults(current as OrderItem, quantityPatchInput)
      : {};

  const { data: updated, error } = await supabase
    .from('order_items')
    .update({ ...data, ...quantityPatch, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select(ORDER_ITEM_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return updated as OrderItemWithDetails;
}

export async function deleteOrderItem(itemId: string): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canDeleteOrderItems) {
    throw new Error('You do not have permission to delete order items');
  }
  const supabase = await createClient();
  await verifyOrderItemBelongsToOrg(itemId, orgId, bcConnectionId);

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw error;
  }
}

export async function reorderOrderItems(
  items: { id: string; sort_order: number }[]
): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canEditOrderItems) {
    throw new Error('You do not have permission to reorder order items');
  }
  const supabase = await createClient();

  for (const item of items) {
    await verifyOrderItemBelongsToOrg(item.id, orgId, bcConnectionId);
    const { error } = await supabase
      .from('order_items')
      .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      throw error;
    }
  }
}
