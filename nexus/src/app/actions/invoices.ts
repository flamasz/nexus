'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusinessCentralScope, requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import {
  EligibleInvoiceOrderItem,
  InvoiceOption,
  InvoiceParty,
  InvoiceStatus,
  OrderItemInvoicePatch,
  OrderItemWithDetails,
  PurchaseInvoice,
  PurchaseInvoiceWithAssignedItems,
} from '@/types/database';

export interface InvoiceInput {
  invoice_party: InvoiceParty;
  invoice_number: string;
  counterparty_name?: string | null;
  invoice_date?: string | null;
  invoice_due_date?: string | null;
  status?: InvoiceStatus;
}

type OrderItemWithOrder = OrderItemWithDetails & {
  order_number: string;
  order_date: string;
};

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanNullableDate(value: string | null | undefined) {
  return value || null;
}

function normalizeInvoiceInput(input: InvoiceInput) {
  const invoiceNumber = input.invoice_number.trim();
  if (!invoiceNumber) {
    throw new Error('Invoice number is required');
  }

  return {
    invoice_party: input.invoice_party,
    invoice_number: invoiceNumber,
    counterparty_name: cleanNullableText(input.counterparty_name),
    invoice_date: cleanNullableDate(input.invoice_date),
    invoice_due_date: cleanNullableDate(input.invoice_due_date),
    status: input.status ?? 'draft',
  };
}

function assignmentColumnForParty(party: InvoiceParty) {
  return party === 'supplier' ? 'supplier_invoice_id' : 'manufacturer_invoice_id';
}

function assertInvoiceParty(value: string): asserts value is InvoiceParty {
  if (value !== 'supplier' && value !== 'manufacturer') {
    throw new Error('Invalid invoice party');
  }
}

function revalidateInvoiceSurfaces() {
  revalidatePath('/invoices');
  revalidatePath('/orders');
}

async function getInvoiceInOrg(invoiceId: string, orgId: string, bcConnectionId: string): Promise<PurchaseInvoice> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (error || !data) {
    throw new Error('Invoice not found or access denied');
  }

  return data as PurchaseInvoice;
}

async function getOrderItemPatchInOrg(itemId: string, orgId: string, bcConnectionId: string): Promise<OrderItemInvoicePatch> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      supplier_invoice_id,
      manufacturer_invoice_id,
      supplier_inv_qty,
      manufacturer_inv_qty,
      supplier_inv_qty_manual,
      manufacturer_inv_qty_manual,
      updated_at,
      purchase_orders!inner(organization_id, bc_connection_id)
    `)
    .eq('id', itemId)
    .eq('purchase_orders.organization_id', orgId)
    .eq('purchase_orders.bc_connection_id', bcConnectionId)
    .single();

  if (error || !data) {
    throw new Error('Order item not found or access denied');
  }

  const row = data as {
    id: string;
    supplier_invoice_id: string | null;
    manufacturer_invoice_id: string | null;
    supplier_inv_qty: number | null;
    manufacturer_inv_qty: number | null;
    supplier_inv_qty_manual: boolean;
    manufacturer_inv_qty_manual: boolean;
    updated_at: string;
  };

  return {
    orderItemId: row.id,
    supplier_invoice_id: row.supplier_invoice_id,
    manufacturer_invoice_id: row.manufacturer_invoice_id,
    supplier_inv_qty: row.supplier_inv_qty,
    manufacturer_inv_qty: row.manufacturer_inv_qty,
    supplier_inv_qty_manual: row.supplier_inv_qty_manual,
    manufacturer_inv_qty_manual: row.manufacturer_inv_qty_manual,
    updated_at: row.updated_at,
  };
}

async function getOrderItemsForWorkspace(orgId: string, bcConnectionId: string): Promise<OrderItemWithOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      order_number,
      order_date,
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

  return ((data || []) as Array<{
    order_number: string;
    order_date: string;
    order_items: OrderItemWithDetails[] | null;
  }>).flatMap((order) =>
    (order.order_items || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        ...item,
        order_number: order.order_number,
        order_date: order.order_date,
      }))
  );
}

function attachAssignedItems(
  invoices: PurchaseInvoice[],
  orderItems: OrderItemWithOrder[]
): PurchaseInvoiceWithAssignedItems[] {
  return invoices.map((invoice) => {
    const column = assignmentColumnForParty(invoice.invoice_party);
    return {
      ...invoice,
      assigned_items: orderItems.filter((item) => item[column] === invoice.id),
    };
  });
}

export async function getInvoiceOptions(): Promise<InvoiceOption[]> {
  const supabase = await createClient();
  const context = await getActiveBusinessCentralScope();
  if (!context.access.canViewInvoices || !context.bcConnectionId) {
    return [];
  }

  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_party, invoice_number, counterparty_name, status, invoice_date, invoice_due_date, created_at')
    .eq('organization_id', context.orgId)
    .eq('bc_connection_id', context.bcConnectionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as InvoiceOption[];
}

export async function getInvoiceWorkspaceData(): Promise<{
  invoices: PurchaseInvoiceWithAssignedItems[];
  eligible_items: Record<InvoiceParty, EligibleInvoiceOrderItem[]>;
}> {
  const supabase = await createClient();
  const context = await getActiveBusinessCentralScope();
  if (!context.access.canViewInvoices || !context.bcConnectionId) {
    return {
      invoices: [],
      eligible_items: { supplier: [], manufacturer: [] },
    };
  }

  const [{ data: invoices, error }, orderItems] = await Promise.all([
    supabase
      .from('purchase_invoices')
      .select('*')
      .eq('organization_id', context.orgId)
      .eq('bc_connection_id', context.bcConnectionId)
      .order('updated_at', { ascending: false }),
    getOrderItemsForWorkspace(context.orgId, context.bcConnectionId),
  ]);

  if (error) {
    throw error;
  }

  return {
    invoices: attachAssignedItems((invoices || []) as PurchaseInvoice[], orderItems),
    eligible_items: {
      supplier: orderItems.filter((item) => !item.supplier_invoice_id),
      manufacturer: orderItems.filter((item) => !item.manufacturer_invoice_id),
    },
  };
}

export async function createInvoice(input: InvoiceInput): Promise<PurchaseInvoice> {
  const { orgId, bcConnectionId, user, access } = await requireActiveBusinessCentralScope();
  if (!access.canViewInvoices || !access.canCreateInvoices) {
    throw new Error('You do not have permission to create invoices');
  }
  const supabase = await createClient();
  const normalized = normalizeInvoiceInput(input);

  const { data, error } = await supabase
    .from('purchase_invoices')
    .insert({
      ...normalized,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create invoice');
  }

  revalidateInvoiceSurfaces();
  return data as PurchaseInvoice;
}

export async function updateInvoice(invoiceId: string, input: InvoiceInput): Promise<PurchaseInvoice> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canViewInvoices || !access.canEditInvoices) {
    throw new Error('You do not have permission to edit invoices');
  }
  const supabase = await createClient();
  await getInvoiceInOrg(invoiceId, orgId, bcConnectionId);
  const normalized = normalizeInvoiceInput(input);

  const { data, error } = await supabase
    .from('purchase_invoices')
    .update({
      ...normalized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update invoice');
  }

  revalidateInvoiceSurfaces();
  return data as PurchaseInvoice;
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canViewInvoices || !access.canDeleteInvoices) {
    throw new Error('You do not have permission to delete invoices');
  }
  const supabase = await createClient();
  const invoice = await getInvoiceInOrg(invoiceId, orgId, bcConnectionId);

  if (invoice.status !== 'draft') {
    throw new Error('Only draft invoices can be deleted');
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) {
    throw error;
  }

  revalidateInvoiceSurfaces();
}

export async function assignInvoiceToOrderItem(
  itemId: string,
  invoiceId: string,
  party: InvoiceParty
): Promise<OrderItemInvoicePatch> {
  assertInvoiceParty(party);
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canViewInvoices || !access.canAssignInvoices) {
    throw new Error('You do not have permission to assign invoices');
  }
  const supabase = await createClient();
  const invoice = await getInvoiceInOrg(invoiceId, orgId, bcConnectionId);

  if (invoice.invoice_party !== party) {
    throw new Error('Invoice party does not match assignment side');
  }

  await getOrderItemPatchInOrg(itemId, orgId, bcConnectionId);
  const column = assignmentColumnForParty(party);
  const invQtyColumn = party === 'supplier' ? 'supplier_inv_qty' : 'manufacturer_inv_qty';
  const invQtyManualColumn =
    party === 'supplier' ? 'supplier_inv_qty_manual' : 'manufacturer_inv_qty_manual';

  const { data: currentItem, error: currentItemError } = await supabase
    .from('order_items')
    .select('accept_qty, supplier_inv_qty_manual, manufacturer_inv_qty_manual')
    .eq('id', itemId)
    .single();

  if (currentItemError || !currentItem) {
    throw currentItemError ?? new Error('Order item not found');
  }

  const updatePayload: Record<string, string | number | null> = {
    [column]: invoiceId,
    updated_at: new Date().toISOString(),
  };

  if (!currentItem[invQtyManualColumn as 'supplier_inv_qty_manual' | 'manufacturer_inv_qty_manual']) {
    updatePayload[invQtyColumn] = currentItem.accept_qty;
  }

  const { error } = await supabase
    .from('order_items')
    .update(updatePayload)
    .eq('id', itemId);

  if (error) {
    throw error;
  }

  revalidateInvoiceSurfaces();
  return getOrderItemPatchInOrg(itemId, orgId, bcConnectionId);
}

export async function assignInvoiceToOrderItems(
  itemIds: string[],
  invoiceId: string,
  party: InvoiceParty
): Promise<OrderItemInvoicePatch[]> {
  const patches: OrderItemInvoicePatch[] = [];
  for (const itemId of itemIds) {
    patches.push(await assignInvoiceToOrderItem(itemId, invoiceId, party));
  }
  return patches;
}

export async function unassignInvoiceFromOrderItem(
  itemId: string,
  party: InvoiceParty
): Promise<OrderItemInvoicePatch> {
  assertInvoiceParty(party);
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canViewInvoices || !access.canAssignInvoices) {
    throw new Error('You do not have permission to unassign invoices');
  }
  const supabase = await createClient();
  await getOrderItemPatchInOrg(itemId, orgId, bcConnectionId);
  const column = assignmentColumnForParty(party);

  const { error } = await supabase
    .from('order_items')
    .update({
      [column]: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw error;
  }

  revalidateInvoiceSurfaces();
  return getOrderItemPatchInOrg(itemId, orgId, bcConnectionId);
}

export async function updateInvoiceOrderItemQuantity(
  itemId: string,
  party: InvoiceParty,
  invQty: number | null
): Promise<OrderItemInvoicePatch> {
  assertInvoiceParty(party);
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canViewInvoices || !access.canAssignInvoices) {
    throw new Error('You do not have permission to edit invoice quantities');
  }
  const supabase = await createClient();
  await getOrderItemPatchInOrg(itemId, orgId, bcConnectionId);
  const invQtyColumn = party === 'supplier' ? 'supplier_inv_qty' : 'manufacturer_inv_qty';
  const manualColumn =
    party === 'supplier' ? 'supplier_inv_qty_manual' : 'manufacturer_inv_qty_manual';

  const { error } = await supabase
    .from('order_items')
    .update({
      [invQtyColumn]: invQty,
      [manualColumn]: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw error;
  }

  revalidateInvoiceSurfaces();
  return getOrderItemPatchInOrg(itemId, orgId, bcConnectionId);
}
