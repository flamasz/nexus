import { describe, expect, it } from 'vitest';

import { applyOrderItemQuantityDefaults, calculateOverrunPercent } from './orderItemQuantityDefaults';

const base = {
  order_qty: 100,
  overrun_qty: null,
  accept_qty: null,
  supplier_inv_qty: null,
  manufacturer_inv_qty: null,
  overrun_qty_manual: false,
  accept_qty_manual: false,
  supplier_inv_qty_manual: false,
  manufacturer_inv_qty_manual: false,
};

describe('applyOrderItemQuantityDefaults', () => {
  it('cascades order quantity through unlocked quantity fields', () => {
    expect(applyOrderItemQuantityDefaults(base, { order_qty: 120 })).toMatchObject({
      order_qty: 120,
      overrun_qty: 120,
      accept_qty: 120,
      supplier_inv_qty: 120,
      manufacturer_inv_qty: 120,
    });
  });

  it('marks overrun as manual and cascades accept/invoice quantities while unlocked', () => {
    expect(applyOrderItemQuantityDefaults({ ...base, order_qty: 100 }, { overrun_qty: 130 })).toMatchObject({
      overrun_qty: 130,
      overrun_qty_manual: true,
      accept_qty: 130,
      supplier_inv_qty: 130,
      manufacturer_inv_qty: 130,
    });
  });

  it('preserves manually edited dependent fields', () => {
    expect(
      applyOrderItemQuantityDefaults(
        {
          ...base,
          order_qty: 100,
          overrun_qty: 110,
          accept_qty: 105,
          supplier_inv_qty: 104,
          accept_qty_manual: true,
          supplier_inv_qty_manual: true,
        },
        { overrun_qty: 130 }
      )
    ).toMatchObject({
      overrun_qty: 130,
      overrun_qty_manual: true,
    });
  });
});

describe('calculateOverrunPercent', () => {
  it('calculates percent over order quantity', () => {
    expect(calculateOverrunPercent(100, 125)).toBe(25);
  });

  it('returns null for missing or zero order quantity', () => {
    expect(calculateOverrunPercent(null, 125)).toBeNull();
    expect(calculateOverrunPercent(0, 125)).toBeNull();
  });
});
