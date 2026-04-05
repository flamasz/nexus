'use client';

import { useState, useEffect, useRef } from 'react';
import { Category, DimensionUnit } from '@/types/database';
import { CATEGORY_COLORS, COLOR_KEYS, getColorForCategory, isHexColor } from '@/lib/categoryColors';
import { getRecentCustomColors, addRecentCustomColor } from '@/app/actions/settings';

interface CategoryFormProps {
  category?: Category;
  initialName?: string;
  onSubmit: (data: {
    name: string;
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: DimensionUnit;
    color: string;
  }) => Promise<void>;
  onCancel: () => void;
  zIndex?: number;
}

export function CategoryForm({
  category,
  initialName,
  onSubmit,
  onCancel,
  zIndex = 50,
}: CategoryFormProps) {
  const defaultName = category?.name || initialName?.trim() || '';
  const [name, setName] = useState(defaultName);
  const [widthVal, setWidthVal] = useState(category?.width?.toString() || '');
  const [heightVal, setHeightVal] = useState(category?.height?.toString() || '');
  const [depthVal, setDepthVal] = useState(category?.depth?.toString() || '');
  const [unit, setUnit] = useState<DimensionUnit>(category?.unit || 'mm');
  
  // Color can be a preset key or a hex string
  const initialColor = category?.color || getColorForCategory(defaultName || 'New Category');
  const [color, setColor] = useState<string>(initialColor);
  
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [previewColor, setPreviewColor] = useState('#3B82F6');
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const colorPickerButtonRef = useRef<HTMLButtonElement>(null);
  const colorPickerPopoverRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load recent custom colors on mount
  useEffect(() => {
    getRecentCustomColors().then(setRecentColors).catch(console.error);
  }, []);

  // Close color picker on click outside or Escape
  useEffect(() => {
    if (!showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorPickerPopoverRef.current &&
        !colorPickerPopoverRef.current.contains(e.target as Node) &&
        colorPickerButtonRef.current &&
        !colorPickerButtonRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showColorPicker]);

  const handleSelectCustomColor = async () => {
    setColor(previewColor);
    const updated = await addRecentCustomColor(previewColor);
    setRecentColors(updated);
    setShowColorPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    const w = widthVal.trim() ? parseFloat(widthVal) : null;
    const h = heightVal.trim() ? parseFloat(heightVal) : null;
    const d = depthVal.trim() ? parseFloat(depthVal) : null;

    // Only validate if values are provided
    if ((w !== null && (isNaN(w) || w <= 0)) ||
        (h !== null && (isNaN(h) || h <= 0)) ||
        (d !== null && (isNaN(d) || d <= 0))) {
      setError('Dimensions must be positive numbers if provided');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        width: w,
        height: h,
        depth: d,
        unit,
        color,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      <div className="bg-surface-overlay border border-border rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {category ? 'Edit Category' : 'New Category'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-destructive-subtle border border-destructive/30 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="categoryName" className="block text-sm font-medium text-foreground mb-1">
                Category Name
              </label>
              <input
                id="categoryName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                placeholder="e.g., Small Box, Large Pouch"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Dimensions (W × H × D)
              </label>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  value={widthVal}
                  onChange={(e) => setWidthVal(e.target.value)}
                  className="px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="W"
                  step="any"
                  min="0"
                />
                <input
                  type="number"
                  value={heightVal}
                  onChange={(e) => setHeightVal(e.target.value)}
                  className="px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="H"
                  step="any"
                  min="0"
                />
                <input
                  type="number"
                  value={depthVal}
                  onChange={(e) => setDepthVal(e.target.value)}
                  className="px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="D"
                  step="any"
                  min="0"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as DimensionUnit)}
                  className="px-3 py-2 border border-border bg-surface text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Badge Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_KEYS.map((colorKey) => {
                  const colorClasses = CATEGORY_COLORS[colorKey];
                  const isSelected = color === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setColor(colorKey)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${colorClasses.bg} ${
                        isSelected ? 'ring-2 ring-offset-2 ring-blue-500 border-gray-400' : 'border-transparent hover:border-gray-300'
                      }`}
                      title={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
                    >
                      {isSelected && (
                        <svg className={`w-4 h-4 ${colorClasses.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
                
                {/* Custom color picker button */}
                <div className="relative">
                  <button
                    ref={colorPickerButtonRef}
                    type="button"
                    onClick={() => {
                      setPreviewColor(isHexColor(color) ? color : '#3B82F6');
                      setShowColorPicker(true);
                    }}
                    className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center transition-all hover:border-gray-400"
                    style={{
                      background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    }}
                    title="Custom color"
                  >
                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </button>
                  
                  {/* Color picker popover */}
                  {showColorPicker && (
                    <div 
                      ref={colorPickerPopoverRef}
                      className="absolute top-10 left-0 bg-surface-overlay border border-border rounded-lg shadow-lg p-4 z-50"
                      style={{ minWidth: '200px' }}
                    >
                      <input
                        ref={colorPickerRef}
                        type="color"
                        value={previewColor}
                        onChange={(e) => setPreviewColor(e.target.value.toUpperCase())}
                        className="w-full h-32 cursor-pointer border-0 p-0"
                        style={{ WebkitAppearance: 'none' }}
                      />
                      
                      <div className="flex items-center gap-2 mt-3 mb-3">
                        <span 
                          className="w-8 h-8 rounded border border-border"
                          style={{ backgroundColor: previewColor }}
                        />
                        <span className="text-sm font-mono text-foreground-muted">{previewColor}</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={handleSelectCustomColor}
                        className="w-full py-2 px-4 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-md transition-colors text-sm"
                      >
                        Select
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Recent custom colors */}
              {recentColors.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs text-foreground-subtle mb-1.5">
                    Recent Colors
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {recentColors.map((hexColor) => {
                      const isSelected = color.toUpperCase() === hexColor.toUpperCase();
                      return (
                        <button
                          key={hexColor}
                          type="button"
                          onClick={() => setColor(hexColor)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'ring-2 ring-offset-2 ring-blue-500 border-gray-400' : 'border-transparent hover:border-gray-300'
                          }`}
                          style={{ backgroundColor: hexColor }}
                          title={hexColor}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                {loading ? 'Saving...' : category ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
