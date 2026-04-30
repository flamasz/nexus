import { describe, it, expect } from 'vitest';
import { gramsToOunces, unitsPerPallet, GRAMS_PER_OUNCE } from './calculations';

describe('gramsToOunces', () => {
  it('returns 0 for zero grams', () => {
    expect(gramsToOunces(0)).toBe(0);
  });

  it('converts grams to ounces rounded to 0.1', () => {
    expect(gramsToOunces(GRAMS_PER_OUNCE)).toBe(1);
    expect(gramsToOunces(GRAMS_PER_OUNCE * 2)).toBe(2);
  });

  it('rounds to nearest 0.1 oz', () => {
    expect(gramsToOunces(100)).toBe(3.5);
    expect(gramsToOunces(50)).toBe(1.8);
  });

  it('returns null for negative input', () => {
    expect(gramsToOunces(-1)).toBeNull();
  });

  it('returns null for null/undefined/NaN/Infinity', () => {
    expect(gramsToOunces(null)).toBeNull();
    expect(gramsToOunces(undefined)).toBeNull();
    expect(gramsToOunces(Number.NaN)).toBeNull();
    expect(gramsToOunces(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('unitsPerPallet', () => {
  it('multiplies the three inputs', () => {
    expect(unitsPerPallet(10, 5, 4)).toBe(200);
  });

  it('returns 0 when any value is 0', () => {
    expect(unitsPerPallet(0, 5, 4)).toBe(0);
    expect(unitsPerPallet(10, 0, 4)).toBe(0);
    expect(unitsPerPallet(10, 5, 0)).toBe(0);
  });

  it('returns null when any value is missing', () => {
    expect(unitsPerPallet(null, 5, 4)).toBeNull();
    expect(unitsPerPallet(10, undefined, 4)).toBeNull();
    expect(unitsPerPallet(10, 5, null)).toBeNull();
  });

  it('returns null for non-integer input', () => {
    expect(unitsPerPallet(10.5, 5, 4)).toBeNull();
    expect(unitsPerPallet(10, 5.2, 4)).toBeNull();
  });

  it('returns null for negative input', () => {
    expect(unitsPerPallet(-1, 5, 4)).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(unitsPerPallet(Number.NaN, 5, 4)).toBeNull();
    expect(unitsPerPallet(10, Number.POSITIVE_INFINITY, 4)).toBeNull();
  });
});
