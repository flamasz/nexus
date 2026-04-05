export type CategoryColorKey =
  | 'blue'
  | 'red'
  | 'green'
  | 'purple'
  | 'amber'
  | 'pink'
  | 'teal'
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'cyan'
  | 'orange';

export const CATEGORY_COLORS: Record<
  CategoryColorKey,
  { bg: string; text: string; border: string }
> = {
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  red: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  green: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
};

export const COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColorKey[];

// Simple hash function to deterministically pick a color based on category name
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getColorForCategory(name: string): CategoryColorKey {
  const hash = hashString(name);
  return COLOR_KEYS[hash % COLOR_KEYS.length];
}

export type CategoryBadgeStyles = 
  | { bg: string; text: string; border: string; style?: undefined }
  | { bg?: undefined; text?: undefined; border?: undefined; style: React.CSSProperties };

export function isHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

export function getCategoryColorClasses(color: string | null | undefined, categoryName: string): CategoryBadgeStyles {
  // Check if it's a preset Tailwind key
  if (color && CATEGORY_COLORS[color as CategoryColorKey]) {
    return CATEGORY_COLORS[color as CategoryColorKey];
  }
  
  // Check if it's a hex color
  if (color && isHexColor(color)) {
    return {
      style: {
        backgroundColor: `${color}20`, // ~12% opacity for light bg
        color: color,
        borderColor: `${color}60`, // ~38% opacity for border
      }
    };
  }
  
  // Fallback: auto-assign from name hash
  const colorKey = getColorForCategory(categoryName);
  return CATEGORY_COLORS[colorKey];
}
