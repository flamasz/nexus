import { Archive, GripVertical, Plus, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/components/ui/category-badge'
import { ItemStatusBadge } from '@/components/ui/item-status-badge'

import { CompactDropdownChip, orderRows, SectionHeading, SurfaceCard } from './shared'

export function SectionOrderWorkflow() {
  return (
    <section id="orders" className="space-y-6">
      <SectionHeading
        title="Purchase Order Workflow"
        description="The design system now captures the current order-block and order-row behavior: sortable rows, compact selectors, formatted quantities, and artwork handoff controls."
      />

      <SurfaceCard title="Order block" eyebrow="Orders">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-bold text-foreground">PO-4821</span>
              <button className="text-xs text-foreground underline decoration-dashed underline-offset-2 hover:text-primary">
                Apr 5, 2026
              </button>
            </div>
            <div className="flex items-center gap-1 text-foreground-subtle">
              <button className="rounded p-1.5 transition-colors hover:bg-surface hover:text-foreground">
                <Archive className="size-4" />
              </button>
              <button className="rounded p-1.5 transition-colors hover:bg-destructive-subtle hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="min-w-[920px]">
            <div className="flex items-center border-b border-border bg-surface-raised px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
              <span className="w-5 shrink-0" />
              <span className="ml-1.5 w-24 shrink-0">Priority</span>
              <span className="ml-1.5 w-20 shrink-0">Row Status</span>
              <span className="ml-1.5 w-56 shrink-0">Item</span>
              <span className="ml-1.5 w-28 shrink-0">Category</span>
              <span className="ml-1.5 w-20 shrink-0 text-right">Qty</span>
              <span className="ml-1.5 w-16 shrink-0">Version</span>
              <span className="ml-1.5 w-24 shrink-0">Approval</span>
              <span className="ml-1.5 min-w-[220px] flex-1">Notes</span>
            </div>

            {orderRows.map((row) => (
              <div key={`${row.item}-${row.version}`} className="flex items-center border-b border-border px-2 py-3 last:border-b-0">
                <span className="w-5 shrink-0 text-foreground-subtle">
                  <GripVertical className="size-4" />
                </span>
                <span className="ml-1.5 w-24 shrink-0">
                  <CompactDropdownChip label={row.priority.label} className={row.priority.className} />
                </span>
                <span className="ml-1.5 w-20 shrink-0">
                  <CompactDropdownChip label={row.orderStatus.label} className={row.orderStatus.className} />
                </span>
                <span className="ml-1.5 w-56 shrink-0 text-sm font-medium text-foreground">{row.item}</span>
                <span className="ml-1.5 w-28 shrink-0">
                  <CategoryBadge category={row.category} />
                </span>
                <span className="ml-1.5 w-20 shrink-0 text-right text-sm text-foreground">{row.qty}</span>
                <span className="ml-1.5 w-16 shrink-0 text-sm font-semibold text-warning">{row.version}</span>
                <span className="ml-1.5 w-24 shrink-0">
                  <ItemStatusBadge status={row.packagingStatus} />
                </span>
                <span className="ml-1.5 min-w-[220px] flex-1 text-sm text-foreground-muted">{row.notes}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
            <span className="rounded-full border border-border bg-surface px-3 py-1">drag to reorder line items</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1">date picker in block header</span>
            <span className="rounded-full border border-border bg-surface px-3 py-1">archive + delete protected by access controls</span>
          </div>
          <Button>
            <Plus className="size-4" />
            Add line item
          </Button>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard title="Order item row anatomy" eyebrow="Compact controls">
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border bg-surface p-3">
              <div className="flex min-w-[980px] items-center gap-2 text-xs">
                <span className="flex w-5 shrink-0 justify-center text-foreground-subtle">
                  <GripVertical className="size-4" />
                </span>
                <div className="w-24 shrink-0">
                  <CompactDropdownChip label="2 - Standard" className="bg-blue-900/30 text-blue-400 border-blue-700/50" />
                </div>
                <div className="w-16 shrink-0">
                  <CompactDropdownChip label="New" className="bg-red-900/30 text-red-400 border-red-700/50" />
                </div>
                <div className="w-56 shrink-0 rounded border border-border bg-surface-raised px-2 py-1.5 text-foreground">
                  Mailer Box
                </div>
                <div className="w-32 shrink-0 rounded border border-border bg-surface-raised px-2 py-1.5">
                  <CategoryBadge category={{ name: 'Mailers', color: 'blue' }} />
                </div>
                <input readOnly value="2,400" className="w-20 shrink-0 rounded border border-border bg-surface px-2 py-1.5 text-right text-foreground outline-none" />
                <div className="w-20 shrink-0 rounded border border-border bg-surface-raised px-2 py-1.5 text-foreground">V3</div>
                <div className="w-24 shrink-0">
                  <ItemStatusBadge status="approved" />
                </div>
                <button className="flex h-8 w-10 shrink-0 items-center justify-center rounded border border-success/30 bg-success-subtle text-success">
                  <Upload className="size-4" />
                </button>
                <input readOnly value="Notes autosave and preserve cursor while qty is re-formatted." className="min-w-[250px] flex-1 rounded border border-border bg-surface px-2 py-1.5 text-foreground outline-none" />
              </div>
            </div>

            <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-surface p-3">Item + category changes reset version until a valid combination exists.</div>
              <div className="rounded-lg border border-border bg-surface p-3">Qty field reformats with thousands separators while keeping cursor position stable.</div>
              <div className="rounded-lg border border-border bg-surface p-3">Packaging approval can update an existing packaging item or create one on first version save.</div>
              <div className="rounded-lg border border-border bg-surface p-3">Notes save on debounce instead of per keystroke.</div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Dropdown semantics" eyebrow="Priority + status">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-foreground-subtle">Priority dropdown</p>
              <div className="flex flex-wrap gap-2">
                <CompactDropdownChip label="1 - Critical" className="bg-red-900/30 text-red-400 border-red-700/50" />
                <CompactDropdownChip label="2 - Standard" className="bg-blue-900/30 text-blue-400 border-blue-700/50" />
                <CompactDropdownChip label="3 - Low" className="bg-gray-800/50 text-gray-400 border-gray-600/50" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-foreground-subtle">Row lifecycle</p>
              <div className="flex flex-wrap gap-2">
                <CompactDropdownChip label="New" className="bg-red-900/30 text-red-400 border-red-700/50" />
                <CompactDropdownChip label="Final" className="bg-green-900/30 text-green-400 border-green-700/50" />
                <CompactDropdownChip label="Cancel" className="bg-gray-800/50 text-gray-400 border-gray-600/50" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4 text-xs text-foreground-muted">
              The live app uses small inline dropdown triggers in each row to avoid modal detours while editing purchase orders.
            </div>
          </div>
        </SurfaceCard>
      </div>
    </section>
  )
}
