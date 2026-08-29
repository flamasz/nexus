'use client';

import { useId, useState, useTransition } from 'react';

import { saveCategoryNumbering } from '@/app/actions/itemCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Category } from '@/types/database';

interface CategoryNumberingBlockProps {
  category: Category;
  canManage: boolean;
  onSaved: (category: Category) => void;
}

export function CategoryNumberingBlock({ category, canManage, onSaved }: CategoryNumberingBlockProps) {
  const [code, setCode] = useState(category.bc_no_series_code ?? '');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const reactId = useId();

  const dirty = code.trim() !== (category.bc_no_series_code ?? '');

  function handleSave() {
    setError('');
    setSuccessMessage('');
    startTransition(async () => {
      try {
        const updated = await saveCategoryNumbering(category.id, {
          bcNoSeriesCode: code.trim() || null,
        });
        setCode(updated.bc_no_series_code ?? '');
        setSuccessMessage(
          updated.bc_no_series_code
            ? `Saved. Stored series code: ${updated.bc_no_series_code}`
            : 'Saved. Item numbers will be entered manually.'
        );
        onSaved(updated);
      } catch (err) {
        // Render the thrown error message verbatim: SeriesNotFoundError and
        // SeriesNotNormalError carry admin-readable text naming the code and
        // the Allow Gaps requirement, and that message is the entire point
        // of validating here rather than at item-creation time.
        setError(err instanceof Error ? err.message : 'Failed to save numbering');
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Numbering</h3>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && successMessage && (
        <div className="rounded-md border border-success/30 bg-success-subtle px-3 py-2 text-sm text-success">
          {successMessage}
        </div>
      )}

      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${reactId}-no-series`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
          No. Series code
        </Label>
        <Input
          id={`${reactId}-no-series`}
          value={code}
          disabled={!canManage}
          onChange={(event) => {
            setCode(event.target.value);
            setSuccessMessage('');
          }}
          className="font-mono"
          placeholder="e.g. ITEM"
        />
        <p className="text-xs text-foreground-muted">
          Leave blank to enter item numbers manually. The series must be Normal (Allow Gaps off) in
          Business Central.
        </p>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!dirty || isPending} onClick={handleSave}>
            {isPending ? 'Checking with Business Central…' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
