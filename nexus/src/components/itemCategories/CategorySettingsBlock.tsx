'use client';

import { useId, useState, useTransition } from 'react';

import { saveCategorySettings } from '@/app/actions/itemCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORY_COLORS, COLOR_KEYS } from '@/lib/categoryColors';
import { cn } from '@/lib/utils';
import { Category, DimensionUnit } from '@/types/database';

const UNIT_OPTIONS: DimensionUnit[] = ['mm', 'cm', 'in'];

function numberToInputValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function inputValueToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface CategorySettingsBlockProps {
  category: Category;
  canManage: boolean;
  onSaved: (category: Category) => void;
}

export function CategorySettingsBlock({ category, canManage, onSaved }: CategorySettingsBlockProps) {
  const [name, setName] = useState(category.name);
  const [width, setWidth] = useState(numberToInputValue(category.width));
  const [height, setHeight] = useState(numberToInputValue(category.height));
  const [depth, setDepth] = useState(numberToInputValue(category.depth));
  const [unit, setUnit] = useState<DimensionUnit>(category.unit);
  const [color, setColor] = useState<string | null>(category.color);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const reactId = useId();

  const dirty =
    name !== category.name ||
    inputValueToNumber(width) !== category.width ||
    inputValueToNumber(height) !== category.height ||
    inputValueToNumber(depth) !== category.depth ||
    unit !== category.unit ||
    color !== category.color;

  function handleSave() {
    setError('');
    startTransition(async () => {
      try {
        const updated = await saveCategorySettings(category.id, {
          name,
          width: inputValueToNumber(width),
          height: inputValueToNumber(height),
          depth: inputValueToNumber(depth),
          unit,
          color,
        });
        setName(updated.name);
        setWidth(numberToInputValue(updated.width));
        setHeight(numberToInputValue(updated.height));
        setDepth(numberToInputValue(updated.depth));
        setUnit(updated.unit);
        setColor(updated.color);
        onSaved(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save category settings');
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Category settings</h3>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${reactId}-name`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
          Name
        </Label>
        <Input
          id={`${reactId}-name`}
          required
          value={name}
          disabled={!canManage}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-width`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Width
          </Label>
          <Input
            id={`${reactId}-width`}
            type="number"
            value={width}
            disabled={!canManage}
            onChange={(event) => setWidth(event.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-height`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Height
          </Label>
          <Input
            id={`${reactId}-height`}
            type="number"
            value={height}
            disabled={!canManage}
            onChange={(event) => setHeight(event.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-depth`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Depth
          </Label>
          <Input
            id={`${reactId}-depth`}
            type="number"
            value={depth}
            disabled={!canManage}
            onChange={(event) => setDepth(event.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-unit`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Unit
          </Label>
          <select
            id={`${reactId}-unit`}
            value={unit}
            disabled={!canManage}
            onChange={(event) => setUnit(event.target.value as DimensionUnit)}
            className="border-input bg-background text-foreground shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full min-w-0 rounded-md border px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-foreground-subtle">Badge colour</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setColor(null)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              color === null ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-surface-raised'
            )}
          >
            None
          </button>
          {COLOR_KEYS.map((key) => {
            const classes = CATEGORY_COLORS[key];
            const selected = color === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!canManage}
                onClick={() => setColor(key)}
                aria-pressed={selected}
                title={key}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  classes.bg,
                  classes.text,
                  classes.border,
                  selected && 'ring-2 ring-primary/40'
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!dirty || isPending} onClick={handleSave}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
