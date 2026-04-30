import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-foreground-muted">{description}</p>
    </div>
  )
}

export function SurfaceCard({
  title,
  eyebrow,
  children,
  className,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('gap-0 border-border bg-surface-raised py-0 card-shadow', className)}>
      <CardHeader className="border-b border-border px-5 py-4">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground-subtle">
            {eyebrow}
          </p>
        )}
        <CardTitle className="text-sm text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  )
}

export function MiniField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  )
}

export function CompactDropdownChip({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium',
        className,
      )}
    >
      {label}
      <ChevronDown className="size-3" />
    </span>
  )
}

export function RoleToggleCard({
  title,
  description,
  checked,
}: {
  title: string
  description: string
  checked: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="mt-1 text-xs text-foreground-muted">{description}</p>
            </div>
            <Switch checked={checked} aria-label={title} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const routeGroups = [
  {
    title: 'Core',
    items: ['Dashboard', 'Analytics'],
  },
  {
    title: 'Purchase Orders',
    items: ['Orders', 'Artwork', 'Invoices', 'Shipments'],
  },
  {
    title: 'System',
    items: ['Settings', 'Help'],
  },
] as const

export const workspaceItems = [
  {
    name: 'Mailer Box',
    category: { name: 'Mailers', color: 'blue' },
    productLine: 'Retail',
    status: 'approved' as const,
    version: 'V3',
    archived: false,
  },
  {
    name: 'Hang Tag',
    category: { name: 'Tags', color: 'amber' },
    productLine: 'Seasonal',
    status: 'in_progress' as const,
    version: 'V2.1',
    archived: false,
  },
  {
    name: 'Sticker Sheet',
    category: { name: 'Labels', color: '#D946EF' },
    productLine: 'Kits',
    status: 'new' as const,
    version: null,
    archived: true,
  },
] as const

export const itemNameOptions = ['Mailer Box', 'Hang Tag', 'Sticker Sheet'] as const
export const productLineOptions = ['Retail', 'Seasonal', 'Kits'] as const
export const versionOptions = [
  { version: 'V3', status: 'approved' as const },
  { version: 'V2.1', status: 'in_progress' as const },
  { version: 'Rev A', status: 'new' as const },
] as const

export const orderRows = [
  {
    priority: { label: '1 - Critical', className: 'bg-red-900/30 text-red-400 border-red-700/50' },
    orderStatus: { label: 'Final', className: 'bg-green-900/30 text-green-400 border-green-700/50' },
    packagingStatus: 'approved' as const,
    item: 'Mailer Box',
    category: { name: 'Mailers', color: 'blue' },
    qty: '2,400',
    version: 'V3',
    notes: 'Notes autosave after a 600ms debounce.',
  },
  {
    priority: { label: '2 - Standard', className: 'bg-blue-900/30 text-blue-400 border-blue-700/50' },
    orderStatus: { label: 'New', className: 'bg-red-900/30 text-red-400 border-red-700/50' },
    packagingStatus: 'in_progress' as const,
    item: 'Hang Tag',
    category: { name: 'Tags', color: 'amber' },
    qty: '1,200',
    version: 'V2.1',
    notes: 'Version list resolves from item + category selection.',
  },
] as const

export const uploadQueue = [
  { name: 'mailer-box-front.ai', size: '3.8 MB', progress: 82, state: 'uploading' },
  { name: 'mailer-box-proof.pdf', size: '1.2 MB', progress: 100, state: 'complete' },
  { name: 'retail-carton.ai', size: '4.4 MB', progress: 0, state: 'pending' },
] as const

export const users = [
  {
    name: 'Jane Doe',
    email: 'jane@nexus.app',
    role: 'Admin',
    labels: ['Purchaser', 'Designer'],
    access: 'Manage users, artwork approvals, catalog edits',
    joined: 'Apr 1, 2026',
  },
  {
    name: 'Kai Tanaka',
    email: 'kai@nexus.app',
    role: 'User',
    labels: ['Designer'],
    access: 'Upload artwork, edit notes, review statuses',
    joined: 'Mar 26, 2026',
  },
] as const

export const recentColors = ['#D946EF', '#22C55E', '#38BDF8'] as const
