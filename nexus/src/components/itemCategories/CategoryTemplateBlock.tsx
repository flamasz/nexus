'use client';

import { useId, useState, useTransition } from 'react';

import { saveCategoryTemplate } from '@/app/actions/itemCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryTemplateInput } from '@/types/itemCategories';
import { Category, ItemTemplate } from '@/types/database';

interface TemplateFormState {
  bcItemCategoryCode: string;
  defaultType: string;
  baseUnitOfMeasureCode: string;
  taxGroupCode: string;
  generalProductPostingGroupCode: string;
  inventoryPostingGroupCode: string;
  priceIncludesTax: boolean;
  blocked: boolean;
}

const EMPTY_FORM: TemplateFormState = {
  bcItemCategoryCode: '',
  defaultType: 'Inventory',
  baseUnitOfMeasureCode: '',
  taxGroupCode: '',
  generalProductPostingGroupCode: '',
  inventoryPostingGroupCode: '',
  priceIncludesTax: false,
  blocked: false,
};

function templateToForm(template: ItemTemplate): TemplateFormState {
  return {
    bcItemCategoryCode: template.bc_item_category_code ?? '',
    defaultType: template.default_type,
    baseUnitOfMeasureCode: template.base_unit_of_measure_code ?? '',
    taxGroupCode: template.tax_group_code ?? '',
    generalProductPostingGroupCode: template.general_product_posting_group_code ?? '',
    inventoryPostingGroupCode: template.inventory_posting_group_code ?? '',
    priceIncludesTax: template.price_includes_tax,
    blocked: template.blocked,
  };
}

function formsEqual(a: TemplateFormState, b: TemplateFormState): boolean {
  return (
    a.bcItemCategoryCode === b.bcItemCategoryCode &&
    a.defaultType === b.defaultType &&
    a.baseUnitOfMeasureCode === b.baseUnitOfMeasureCode &&
    a.taxGroupCode === b.taxGroupCode &&
    a.generalProductPostingGroupCode === b.generalProductPostingGroupCode &&
    a.inventoryPostingGroupCode === b.inventoryPostingGroupCode &&
    a.priceIncludesTax === b.priceIncludesTax &&
    a.blocked === b.blocked
  );
}

interface CategoryTemplateBlockProps {
  category: Category;
  template: ItemTemplate | null;
  canManage: boolean;
  onSaved: (template: ItemTemplate) => void;
}

export function CategoryTemplateBlock({ category, template, canManage, onSaved }: CategoryTemplateBlockProps) {
  const baseline = template ? templateToForm(template) : EMPTY_FORM;
  const [form, setForm] = useState<TemplateFormState>(baseline);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const reactId = useId();

  const dirty = !formsEqual(form, baseline);

  function set<K extends keyof TemplateFormState>(key: K, value: TemplateFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setError('');
    startTransition(async () => {
      try {
        const input: CategoryTemplateInput = {
          bcItemCategoryCode: form.bcItemCategoryCode.trim() || null,
          defaultType: form.defaultType.trim() || 'Inventory',
          baseUnitOfMeasureCode: form.baseUnitOfMeasureCode.trim() || null,
          taxGroupCode: form.taxGroupCode.trim() || null,
          generalProductPostingGroupCode: form.generalProductPostingGroupCode.trim() || null,
          inventoryPostingGroupCode: form.inventoryPostingGroupCode.trim() || null,
          priceIncludesTax: form.priceIncludesTax,
          blocked: form.blocked,
        };
        const updated = await saveCategoryTemplate(category.id, input);
        setForm(templateToForm(updated));
        onSaved(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save template');
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-foreground">Item template defaults</h3>

      {!template && (
        <p className="text-xs text-foreground-muted">
          No template exists yet for this category. Saving will create one.
        </p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-bc-item-category`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            BC item category code
          </Label>
          <Input
            id={`${reactId}-bc-item-category`}
            value={form.bcItemCategoryCode}
            disabled={!canManage}
            onChange={(event) => set('bcItemCategoryCode', event.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-default-type`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Default type
          </Label>
          <Input
            id={`${reactId}-default-type`}
            value={form.defaultType}
            disabled={!canManage}
            onChange={(event) => set('defaultType', event.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-base-uom`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Base unit of measure
          </Label>
          <Input
            id={`${reactId}-base-uom`}
            value={form.baseUnitOfMeasureCode}
            disabled={!canManage}
            onChange={(event) => set('baseUnitOfMeasureCode', event.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-tax-group`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Tax group
          </Label>
          <Input
            id={`${reactId}-tax-group`}
            value={form.taxGroupCode}
            disabled={!canManage}
            onChange={(event) => set('taxGroupCode', event.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-gen-posting`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            General product posting group
          </Label>
          <Input
            id={`${reactId}-gen-posting`}
            value={form.generalProductPostingGroupCode}
            disabled={!canManage}
            onChange={(event) => set('generalProductPostingGroupCode', event.target.value)}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${reactId}-inv-posting`} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
            Inventory posting group
          </Label>
          <Input
            id={`${reactId}-inv-posting`}
            value={form.inventoryPostingGroupCode}
            disabled={!canManage}
            onChange={(event) => set('inventoryPostingGroupCode', event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.priceIncludesTax}
            disabled={!canManage}
            onChange={(event) => set('priceIncludesTax', event.target.checked)}
            className="size-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-50"
          />
          Price includes tax
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.blocked}
            disabled={!canManage}
            onChange={(event) => set('blocked', event.target.checked)}
            className="size-4 rounded border-border disabled:cursor-not-allowed disabled:opacity-50"
          />
          Blocked
        </label>
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
