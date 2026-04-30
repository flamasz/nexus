import { cn } from '@/lib/utils'

type UploadStatus = 'uploaded' | 'approved' | 'rejected'

const STATUS_CONFIG: Record<
  UploadStatus,
  {
    label: string
    bgColor: string
    textColor: string
    borderColor: string
  }
> = {
  uploaded: {
    label: 'Uploaded',
    bgColor: 'bg-info-subtle',
    textColor: 'text-info',
    borderColor: 'border-info/30',
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-success-subtle',
    textColor: 'text-success',
    borderColor: 'border-success/30',
  },
  rejected: {
    label: 'Rejected',
    bgColor: 'bg-destructive-subtle',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/30',
  },
}

interface UploadStatusBadgeProps {
  status: UploadStatus
  className?: string
}

export function UploadStatusBadge({
  status,
  className,
}: UploadStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
