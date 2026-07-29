'use client';

import { useId, useState, useTransition } from 'react';

import { saveCategoryTemplate } from '@/app/actions/itemCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryTemplateInput } from '@/types/itemCategories';
import { Category, ItemTemplate } from '@/types/database';
import type { BusinessCentralReferenceData, BusinessCentralReferenceItem } from '@/types/businessCentralItems';

const ITEM_TYPES = ['Inventory', 'Service', 'Non-Inventory'] as const;

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
  references: BusinessCentralReferenceData | null;
  onSaved: (template: ItemTemplate) => void;
}

interface ReferenceOption {
  code: string;
  label: string;
}

/**
 * Renders a code field as a <select> of known-good codes when options are available,
 * falling back to a free-text <Input> when the reference list is empty or failed to
 * load (so the admin is never stuck facing an unusable, empty dropdown).
 *
 * If the currently-stored value isn't among the known options (e.g. BC no longer
 * returns a code that's still saved on the template), it's injected as an extra,
 * clearly-marked option so it stays visible and selected rather than being silently
 * dropped the next time the form is saved.
 */
function ReferenceCodeField({
  id,
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  options: ReferenceOption[] | undefined;
  onChange: (value: string) => void;
}) {
  const hasOptions = !!options && options.length > 0;
  const isKnown = hasOptions && options!.some((o) => o.code === value);
  const staleValue = hasOptions && value && !isKnown ? value : null;

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-wide text-foreground-subtle">
        {label}
      </Label>
      {hasOptions ? (
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— none —</option>
          {staleValue && (
            <option value={staleValue}>{staleValue} (not found in Business Central)</option>
          )}
          {options!.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function toOptions(items: BusinessCentralReferenceItem[] | undefined): ReferenceOption[] | undefined {
  if (!items) return undefined;
  return items.map((r) => ({
    code: r.code,
    label: r.displayName ? `${r.code} — ${r.displayName}` : r.code,
  }));
}

export function CategoryTemplateBlock({ category, template, canManage, references, onSaved }: CategoryTemplateBlockProps) {
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
        <ReferenceCodeField
          id={`${reactId}-bc-item-category`}
          label="BC item category code"
          value={form.bcItemCategoryCode}
          disabled={!canManage}
          options={toOptions(references?.itemCategories)}
          onChange={(value) => set('bcItemCategoryCode', value)}
        />

        <ReferenceCodeField
          id={`${reactId}-default-type`}
          label="Default type"
          value={form.defaultType}
          disabled={!canManage}
          options={ITEM_TYPES.map((t) => ({ code: t, label: t }))}
          onChange={(value) => set('defaultType', value)}
        />

        <ReferenceCodeField
          id={`${reactId}-base-uom`}
          label="Base unit of measure"
          value={form.baseUnitOfMeasureCode}
          disabled={!canManage}
          options={toOptions(references?.unitsOfMeasure)}
          onChange={(value) => set('baseUnitOfMeasureCode', value)}
        />

        <ReferenceCodeField
          id={`${reactId}-tax-group`}
          label="Tax group"
          value={form.taxGroupCode}
          disabled={!canManage}
          options={toOptions(references?.taxGroups)}
          onChange={(value) => set('taxGroupCode', value)}
        />

        <ReferenceCodeField
          id={`${reactId}-gen-posting`}
          label="General product posting group"
          value={form.generalProductPostingGroupCode}
          disabled={!canManage}
          options={toOptions(references?.generalProductPostingGroups)}
          onChange={(value) => set('generalProductPostingGroupCode', value)}
        />

        <ReferenceCodeField
          id={`${reactId}-inv-posting`}
          label="Inventory posting group"
          value={form.inventoryPostingGroupCode}
          disabled={!canManage}
          options={toOptions(references?.inventoryPostingGroups)}
          onChange={(value) => set('inventoryPostingGroupCode', value)}
        />
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
