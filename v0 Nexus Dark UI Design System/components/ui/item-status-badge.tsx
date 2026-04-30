type ItemStatus = 'new' | 'in_progress' | 'approved' | 'superceded'

const ITEM_STATUS_CONFIG: Record<
  ItemStatus,
  {
    label: string
    bg: string
    text: string
    border: string
  }
> = {
  new: {
    label: 'New',
    bg: 'bg-warning-subtle',
    text: 'text-warning',
    border: 'border-warning/30',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-info-subtle',
    text: 'text-info',
    border: 'border-info/30',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-success-subtle',
    text: 'text-success',
    border: 'border-success/30',
  },
  superceded: {
    label: 'Superceded',
    bg: 'bg-destructive-subtle',
    text: 'text-destructive',
    border: 'border-destructive/30',
  },
}

interface ItemStatusBadgeProps {
  status: ItemStatus
}

export function ItemStatusBadge({ status }: ItemStatusBadgeProps) {
  const config = ITEM_STATUS_CONFIG[status]

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.label}
    </span>
  )
}
