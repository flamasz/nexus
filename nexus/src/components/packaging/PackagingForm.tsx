'use client';

import { useState } from 'react';
import { ItemWithCategory, Category, ProductLine, ItemName } from '@/types/database';
import { CategorySelector } from './CategorySelector';
import { CategoryForm } from './CategoryForm';
import { ProductLineCombobox } from './ProductLineCombobox';
import { ItemNameCombobox } from './ItemNameCombobox';

interface PackagingFormProps {
  item?: ItemWithCategory;
  categories: Category[];
  productLines: ProductLine[];
  itemNames: ItemName[];
  onSubmit: (data: {
    item_name_id: string;
    category_id: string;
    product_line_id: string | null;
    version: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  onCategoryCreated: (category: Category) => void;
  onCategoryUpdated: (category: Category) => void;
  onCreateProductLine: (name: string) => Promise<ProductLine>;
  onCreateItemName: (name: string) => Promise<ItemName>;
  onUpdateItemName: (id: string, name: string) => Promise<ItemName>;
  onArchive?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function PackagingForm({
  item,
  categories,
  productLines,
  itemNames,
  onSubmit,
  onCancel,
  onCategoryCreated,
  onCategoryUpdated,
  onCreateProductLine,
  onCreateItemName,
  onUpdateItemName,
  onArchive,
  onDelete,
}: PackagingFormProps) {
  const [itemNameId, setItemNameId] = useState<string | null>(item?.item_name_id || null);
  const [version, setVersion] = useState(item?.version || '');
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id || null);
  const [productLineId, setProductLineId] = useState<string | null>(item?.product_line_id || null);
  const [newProductLines, setNewProductLines] = useState<ProductLine[]>([]);
  const [newItemNames, setNewItemNames] = useState<ItemName[]>([]);
  const [newCategories, setNewCategories] = useState<Category[]>([]);

  const allProductLines = [...productLines, ...newProductLines].sort((a, b) => a.name.localeCompare(b.name));
  const allItemNames = [...itemNames, ...newItemNames].sort((a, b) => a.name.localeCompare(b.name));
  const allCategories = [...categories, ...newCategories].sort((a, b) => a.name.localeCompare(b.name));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleCreateProductLine = async (plName: string): Promise<ProductLine> => {
    const newProductLine = await onCreateProductLine(plName);
    setNewProductLines((prev) => [...prev, newProductLine]);
    return newProductLine;
  };

  const handleCreateItemName = async (inName: string): Promise<ItemName> => {
    const newItemName = await onCreateItemName(inName);
    setNewItemNames((prev) => [...prev, newItemName]);
    return newItemName;
  };

  const handleUpdateItemName = async (id: string, inName: string): Promise<ItemName> => {
    const updatedItemName = await onUpdateItemName(id, inName);
    setNewItemNames((prev) => prev.map((i) => (i.id === id ? updatedItemName : i)));
    return updatedItemName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!itemNameId) {
      setError('Name is required');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        item_name_id: itemNameId,
        category_id: categoryId,
        product_line_id: productLineId,
        version: version.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (data: {
    name: string;
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: 'mm' | 'cm' | 'in';
    color: string;
  }) => {
    if (!editingCategory) return;
    const { updateCategory } = await import('@/app/actions/categories');
    const updated = await updateCategory(editingCategory.id, data);
    setNewCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingCategory(null);
    onCategoryUpdated(updated);
  };

  const handleCreateNewCategory = async (data: {
    name: string;
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: 'mm' | 'cm' | 'in';
    color: string;
  }) => {
    const { createCategory } = await import('@/app/actions/categories');
    const newCategory = await createCategory(data);
    setNewCategories((prev) => [...prev, newCategory]);
    setCategoryId(newCategory.id);
    setCreatingCategory(false);
    setNewCategoryName('');
    onCategoryCreated(newCategory);
  };

  return (
    <>
      {editingCategory && (
        <CategoryForm
          category={editingCategory}
          onSubmit={handleUpdateCategory}
          onCancel={() => setEditingCategory(null)}
          zIndex={60}
        />
      )}
      {creatingCategory && (
        <CategoryForm
          initialName={newCategoryName}
          onSubmit={handleCreateNewCategory}
          onCancel={() => {
            setCreatingCategory(false);
            setNewCategoryName('');
          }}
          zIndex={60}
        />
      )}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-surface-overlay border border-border rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              {item ? 'Edit Packaging Item' : 'New Packaging Item'}
            </h2>
            {item && (onArchive || onDelete) && (
              <div className="flex items-center gap-2">
                {onArchive && (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="p-2 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-raised rounded-md transition-colors"
                    title={item.archived ? 'Unarchive' : 'Archive'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-2 text-destructive/70 hover:text-destructive hover:bg-destructive-subtle rounded-md transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive-subtle border border-destructive/30 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name <span className="text-destructive">*</span>
              </label>
              <ItemNameCombobox
                itemNames={allItemNames}
                selectedId={itemNameId}
                onSelect={setItemNameId}
                onCreate={handleCreateItemName}
                onUpdate={handleUpdateItemName}
                required
              />
            </div>

            <div>
              <label htmlFor="version" className="block text-sm font-medium text-foreground mb-1">
                Version
              </label>
              <input
                id="version"
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="e.g., V1, V2.1, Rev A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Category <span className="text-destructive">*</span>
              </label>
              <CategorySelector
                categories={allCategories}
                selectedId={categoryId}
                onSelect={setCategoryId}
                onCreateNew={(prefillName) => {
                  setNewCategoryName(prefillName || '');
                  setCreatingCategory(true);
                }}
                onEdit={setEditingCategory}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Product Line
              </label>
              <ProductLineCombobox
                productLines={allProductLines}
                selectedId={productLineId}
                onSelect={setProductLineId}
                onCreate={handleCreateProductLine}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 px-4 border border-border text-foreground font-medium rounded-md hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : item ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
