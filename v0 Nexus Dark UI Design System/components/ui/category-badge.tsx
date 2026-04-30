import { getCategoryColorClasses } from '@/lib/category-colors'

interface CategoryBadgeProps {
  category: {
    name: string
    color?: string | null
  }
  fontWeight?: 'font-medium' | 'font-semibold'
}

export function CategoryBadge({
  category,
  fontWeight = 'font-medium',
}: CategoryBadgeProps) {
  const colorStyles = getCategoryColorClasses(category.color, category.name)
  const base = `inline-block px-2 py-0.5 text-sm ${fontWeight} rounded border`

  if (colorStyles.style) {
    return (
      <span className={base} style={colorStyles.style}>
        {category.name}
      </span>
    )
  }

  return (
    <span
      className={`${base} ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}
    >
      {category.name}
    </span>
  )
}
