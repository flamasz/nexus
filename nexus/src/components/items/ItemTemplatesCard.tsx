'use client';

import { useEffect, useState } from 'react';

import { getCategories } from '@/app/actions/categories';
import { getBusinessCentralItemsPageData } from '@/app/actions/businessCentralItems';
import {
  listItemTemplates,
  createItemTemplate,
  updateItemTemplate,
  deleteItemTemplate,
} from '@/app/actions/itemTemplates';
import type { ItemTemplateInput } from '@/app/actions/itemTemplates';
import type { Category, ItemTemplate } from '@/types/database';
import type { BusinessCentralReferenceData } from '@/types/businessCentralItems';

const ITEM_TYPES = ['Inventory', 'Service', 'Non-Inventory'] as const;

const EMPTY_FORM: ItemTemplateInput = {
  name: '',
  description: '',
  categoryId: null,
  bcItemCategoryCode: null,
  defaultType: 'Inventory',
  baseUnitOfMeasureCode: null,
  taxGroupCode: null,
  generalProductPostingGroupCode: null,
  inventoryPostingGroupCode: null,
  priceIncludesTax: false,
  blocked: false,
};

function templateToForm(t: ItemTemplate): ItemTemplateInput {
  return {
    name: t.name,
    description: t.description ?? '',
    categoryId: t.category_id,
    bcItemCategoryCode: t.bc_item_category_code,
    defaultType: t.default_type,
    baseUnitOfMeasureCode: t.base_unit_of_measure_code,
    taxGroupCode: t.tax_group_code,
    generalProductPostingGroupCode: t.general_product_posting_group_code,
    inventoryPostingGroupCode: t.inventory_posting_group_code,
    priceIncludesTax: t.price_includes_tax,
    blocked: t.blocked,
  };
}

interface TemplateFormProps {
  form: ItemTemplateInput;
  onChange: (form: ItemTemplateInput) => void;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
  categories: Category[];
  references: BusinessCentralReferenceData;
  submitLabel: string;
  busy: boolean;
}

function TemplateForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  categories,
  references,
  submitLabel,
  busy,
}: TemplateFormProps) {
  const set = <K extends keyof ItemTemplateInput>(key: K, value: ItemTemplateInput[K]) =>
    onChange({ ...form, [key]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit();
  };

  return (
    <div className="px-6 py-5 border-t border-border bg-surface-raised">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Template name"
            />
          </div>

          {/* Packaging category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Packaging category <span className="text-destructive">*</span>
            </label>
            <select
              required
              value={form.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.bc_no_series_code ?? 'manual'})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Optional description"
            />
          </div>

          {/* BC item category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">BC item category</label>
            <select
              value={form.bcItemCategoryCode ?? ''}
              onChange={(e) => set('bcItemCategoryCode', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {references.itemCategories.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}{r.displayName ? ` — ${r.displayName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Default type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Default type</label>
            <select
              value={form.defaultType ?? 'Inventory'}
              onChange={(e) => set('defaultType', e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Base unit of measure */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Base unit of measure</label>
            <select
              value={form.baseUnitOfMeasureCode ?? ''}
              onChange={(e) => set('baseUnitOfMeasureCode', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {references.unitsOfMeasure.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}{r.displayName ? ` — ${r.displayName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tax group */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tax group</label>
            <select
              value={form.taxGroupCode ?? ''}
              onChange={(e) => set('taxGroupCode', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {references.taxGroups.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}{r.displayName ? ` — ${r.displayName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* General product posting group */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">General product posting group</label>
            <select
              value={form.generalProductPostingGroupCode ?? ''}
              onChange={(e) => set('generalProductPostingGroupCode', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {references.generalProductPostingGroups.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}{r.displayName ? ` — ${r.displayName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Inventory posting group */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Inventory posting group</label>
            <select
              value={form.inventoryPostingGroupCode ?? ''}
              onChange={(e) => set('inventoryPostingGroupCode', e.target.value || null)}
              className="w-full px-3 py-2 border border-border bg-surface rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— none —</option>
              {references.inventoryPostingGroups.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code}{r.displayName ? ` — ${r.displayName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="sm:col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.priceIncludesTax ?? false}
                onChange={(e) => set('priceIncludesTax', e.target.checked)}
                className="rounded border-border"
              />
              Price includes tax
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.blocked ?? false}
                onChange={(e) => set('blocked', e.target.checked)}
                className="rounded border-border"
              />
              Blocked
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-primary-foreground rounded-md transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving...' : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const EMPTY_REFERENCES: BusinessCentralReferenceData = {
  itemCategories: [],
  taxGroups: [],
  unitsOfMeasure: [],
  generalProductPostingGroups: [],
  inventoryPostingGroups: [],
};

export function ItemTemplatesCard() {
  const [templates, setTemplates] = useState<ItemTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [references, setReferences] = useState<BusinessCentralReferenceData>(EMPTY_REFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ItemTemplate | null>(null);
  const [createForm, setCreateForm] = useState<ItemTemplateInput>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ItemTemplateInput>(EMPTY_FORM);

  useEffect(() => {
    let active = true;
    Promise.all([
      listItemTemplates(),
      getCategories(),
      getBusinessCentralItemsPageData().then((d) => d.references),
    ])
      .then(([tmpl, cats, refs]) => {
        if (!active) return;
        setTemplates(tmpl);
        setCategories(cats);
        setReferences(refs);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load item templates data:', err);
        setError('Failed to load templates');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const reloadTemplates = async () => {
    const data = await listItemTemplates();
    setTemplates(data);
  };

  const handleCreate = async () => {
    setBusyId('create');
    setError('');
    try {
      await createItemTemplate(createForm);
      await reloadTemplates();
      setShowCreateForm(false);
      setCreateForm(EMPTY_FORM);
    } catch (err) {
      console.error('Failed to create item template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;
    setBusyId(editingTemplate.id);
    setError('');
    try {
      await updateItemTemplate(editingTemplate.id, editForm);
      await reloadTemplates();
      setEditingTemplate(null);
    } catch (err) {
      console.error('Failed to update item template:', err);
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (template: ItemTemplate) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    setBusyId(template.id);
    setError('');
    try {
      await deleteItemTemplate(template.id);
      await reloadTemplates();
    } catch (err) {
      console.error('Failed to delete item template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (template: ItemTemplate) => {
    setEditingTemplate(template);
    setEditForm(templateToForm(template));
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
  };

  const startCreate = () => {
    setShowCreateForm(true);
    setEditingTemplate(null);
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setCreateForm(EMPTY_FORM);
  };

  const categoryById = (id: string | null) => categories.find((c) => c.id === id) ?? null;

  return (
    <div className="bg-surface rounded-lg border border-border shadow-sm mt-6">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Item Templates</h2>
          <p className="text-sm text-foreground-muted mt-0.5">
            Saved bundles of default BC item fields, keyed to a packaging category.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-primary-foreground rounded-md transition-colors"
        >
          + New Template
        </button>
      </div>

      {error && (
        <div className="px-6 pt-4">
          <div className="p-3 bg-destructive-subtle border border-destructive/30 text-destructive rounded-md text-sm">
            {error}
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {loading ? (
          <div className="px-6 py-8 text-center text-foreground-muted">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="px-6 py-8 text-center text-foreground-muted">
            <p>No templates yet</p>
            <button
              onClick={startCreate}
              className="mt-2 text-sm text-primary hover:text-primary-hover"
            >
              Create your first template
            </button>
          </div>
        ) : (
          templates.map((template) => {
            const cat = categoryById(template.category_id);
            const busy = busyId === template.id;
            const isEditing = editingTemplate?.id === template.id;
            return (
              <div key={template.id}>
                <div className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                    <p className="text-xs text-foreground-muted truncate mt-0.5">
                      {cat
                        ? `${cat.name} · series: ${cat.bc_no_series_code ?? 'manual'}`
                        : 'No category'}
                      {template.default_type ? ` · ${template.default_type}` : ''}
                    </p>
                    {template.description && (
                      <p className="text-xs text-foreground-subtle truncate mt-0.5">
                        {template.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => (isEditing ? cancelEdit() : startEdit(template))}
                      disabled={busy}
                      className="px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground hover:bg-surface-raised rounded-md transition-colors disabled:opacity-50"
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      disabled={busy}
                      className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive-subtle rounded-md transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      {busy ? 'Working...' : 'Delete'}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <TemplateForm
                    form={editForm}
                    onChange={setEditForm}
                    onSubmit={handleUpdate}
                    onCancel={cancelEdit}
                    categories={categories}
                    references={references}
                    submitLabel="Save changes"
                    busy={busyId === template.id}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {showCreateForm && (
        <TemplateForm
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          onCancel={cancelCreate}
          categories={categories}
          references={references}
          submitLabel="Create template"
          busy={busyId === 'create'}
        />
      )}
    </div>
  );
}
