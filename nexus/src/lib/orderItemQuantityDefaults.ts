import { OrderItem } from '@/types/database';

export type QuantityPatch = Partial<
  Pick<
    OrderItem,
    | 'order_qty'
    | 'overrun_qty'
    | 'accept_qty'
    | 'supplier_inv_qty'
    | 'manufacturer_inv_qty'
    | 'overrun_qty_manual'
    | 'accept_qty_manual'
    | 'supplier_inv_qty_manual'
    | 'manufacturer_inv_qty_manual'
  >
>;

export function calculateOverrunPercent(orderQty: number | null, overrunQty: number | null) {
  if (!orderQty || overrunQty === null) {
    return null;
  }

  return ((overrunQty - orderQty) / orderQty) * 100;
}

export function applyOrderItemQuantityDefaults(
  current: Pick<
    OrderItem,
    | 'order_qty'
    | 'overrun_qty'
    | 'accept_qty'
    | 'supplier_inv_qty'
    | 'manufacturer_inv_qty'
    | 'overrun_qty_manual'
    | 'accept_qty_manual'
    | 'supplier_inv_qty_manual'
    | 'manufacturer_inv_qty_manual'
  >,
  patch: QuantityPatch
): QuantityPatch {
  const next = { ...current, ...patch };
  const update: QuantityPatch = { ...patch };

  const overrunWasEdited = 'overrun_qty' in patch;
  const acceptWasEdited = 'accept_qty' in patch;
  const supplierInvWasEdited = 'supplier_inv_qty' in patch;
  const manufacturerInvWasEdited = 'manufacturer_inv_qty' in patch;

  if (overrunWasEdited) {
    next.overrun_qty_manual = true;
    update.overrun_qty_manual = true;
  }
  if (acceptWasEdited) {
    next.accept_qty_manual = true;
    update.accept_qty_manual = true;
  }
  if (supplierInvWasEdited) {
    next.supplier_inv_qty_manual = true;
    update.supplier_inv_qty_manual = true;
  }
  if (manufacturerInvWasEdited) {
    next.manufacturer_inv_qty_manual = true;
    update.manufacturer_inv_qty_manual = true;
  }

  if ('order_qty' in patch && !next.overrun_qty_manual) {
    next.overrun_qty = next.order_qty;
    update.overrun_qty = next.order_qty;
  }

  if ((overrunWasEdited || 'order_qty' in patch || 'overrun_qty' in update) && !next.accept_qty_manual) {
    next.accept_qty = next.overrun_qty;
    update.accept_qty = next.overrun_qty;
  }

  if ((acceptWasEdited || 'accept_qty' in update) && !next.supplier_inv_qty_manual) {
    update.supplier_inv_qty = next.accept_qty;
  }

  if ((acceptWasEdited || 'accept_qty' in update) && !next.manufacturer_inv_qty_manual) {
    update.manufacturer_inv_qty = next.accept_qty;
  }

  return update;
}
