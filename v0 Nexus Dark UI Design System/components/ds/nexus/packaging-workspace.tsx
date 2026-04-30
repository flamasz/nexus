import { PencilLine, Plus, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/components/ui/category-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ItemStatusBadge } from '@/components/ui/item-status-badge'
import { cn } from '@/lib/utils'

import {
  itemNameOptions,
  MiniField,
  productLineOptions,
  recentColors,
  SectionHeading,
  SurfaceCard,
  versionOptions,
  workspaceItems,
} from './shared'

export function SectionPackagingWorkspace() {
  return (
    <section id="workspace" className="space-y-6">
      <SectionHeading
        title="Artwork Workspace Components"
        description="This section now mirrors the live artwork workspace more closely: the searchable packaging rail, combobox-driven metadata controls, and category editor modal."
      />

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <SurfaceCard title="Packaging item rail" eyebrow="Sidebar">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Packaging Items</p>
                <p className="text-xs text-foreground-muted">
                  Search, filter archived, and jump directly into artwork history.
                </p>
              </div>
              <Button size="icon" aria-label="Create new packaging item">
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
              <Input readOnly value="Search items..." className="pl-9 text-foreground-muted" />
            </div>

            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
              {workspaceItems.map((item) => (
                <button
                  key={item.name}
                  className={cn(
                    'w-full px-4 py-3 text-left transition-colors hover:bg-surface-raised',
                    item.name === 'Mailer Box' && 'border-r-2 border-primary bg-primary-subtle',
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        <CategoryBadge category={item.category} fontWeight="font-semibold" />
                        <span className="inline-block rounded border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-sm font-semibold text-purple-300">
                          {item.productLine}
                        </span>
                      </div>
                      {item.version ? (
                        <span className="text-sm font-bold text-warning">{item.version}</span>
                      ) : item.archived ? (
                        <span className="text-xs text-foreground-subtle">Archived</span>
                      ) : null}
                    </div>
                    <p className={cn('font-medium', item.archived ? 'text-foreground-subtle' : 'text-foreground')}>
                      {item.name}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <ItemStatusBadge status={item.status} />
                      {item.archived && item.version && (
                        <span className="text-xs text-foreground-subtle">Archived</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <Checkbox checked aria-label="Show archived" />
              Show archived (1)
            </label>
          </div>
        </SurfaceCard>

        <div className="grid gap-4">
          <SurfaceCard title="Metadata controls" eyebrow="Comboboxes">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniField label="Item name">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1.5 text-sm font-medium text-primary">
                      Mailer Box
                      <button className="rounded-full p-0.5 transition-colors hover:bg-primary/20">
                        <X className="size-3.5" />
                      </button>
                    </span>
                    <button className="text-sm text-foreground-muted hover:text-foreground">Change</button>
                  </div>
                </MiniField>
                <MiniField label="Product line">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1.5 text-sm font-medium text-purple-300">
                      Retail
                      <button className="rounded-full p-0.5 transition-colors hover:bg-purple-500/20">
                        <X className="size-3.5" />
                      </button>
                    </span>
                    <button className="text-sm text-foreground-muted hover:text-foreground">Change</button>
                  </div>
                </MiniField>
                <MiniField label="Category">
                  <div className="rounded-md border border-border bg-surface px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={{ name: 'Mailers', color: 'blue' }} />
                      <span className="text-sm text-foreground-muted">320 × 240 × 80 mm</span>
                    </div>
                  </div>
                </MiniField>
                <MiniField label="Version">
                  <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground">
                    V3 <span className="text-foreground-subtle">/ disabled until item + category are selected</span>
                  </div>
                </MiniField>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="mb-3 flex items-center justify-between text-xs text-foreground-muted">
                    <span>Portal dropdown anatomy</span>
                    <span>search / inline edit / create</span>
                  </div>
                  <div className="space-y-2">
                    {itemNameOptions.map((name, index) => (
                      <div
                        key={name}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                          index === 0 ? 'bg-primary-subtle text-primary' : 'bg-surface-raised text-foreground',
                        )}
                      >
                        <span className="flex-1">{name}</span>
                        <button className="rounded p-1 text-foreground-subtle hover:bg-surface hover:text-foreground">
                          <PencilLine className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-primary-subtle">
                      <Plus className="size-4" />
                      Create “Mailer Box XL”
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-foreground-subtle">
                      Version dropdown
                    </p>
                    <div className="space-y-2">
                      {versionOptions.map((item) => (
                        <div key={item.version} className="flex items-center justify-between rounded-md bg-surface-raised px-3 py-2 text-sm">
                          <span className="text-foreground">{item.version}</span>
                          <ItemStatusBadge status={item.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-foreground-subtle">
                      Product lines
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {productLineOptions.map((line) => (
                        <span key={line} className="rounded-full border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-300">
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
                <span className="rounded-full border border-border bg-surface px-3 py-1">createPortal dropdown positioning</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">inline item-name rename</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1">keyboard selection + create option</span>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Category form" eyebrow="Modal editor">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <MiniField label="Category name">
                  <Input readOnly value="Mailer Box" />
                </MiniField>
                <MiniField label="Dimensions">
                  <div className="grid grid-cols-4 gap-2">
                    <Input readOnly value="320" />
                    <Input readOnly value="240" />
                    <Input readOnly value="80" />
                    <div className="flex items-center justify-center rounded-md border border-border bg-surface px-3 text-sm text-foreground">
                      mm
                    </div>
                  </div>
                </MiniField>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Badge color memory</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {['blue', 'red', 'green', 'purple', 'amber', 'cyan'].map((tone, index) => (
                    <button
                      key={tone}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2',
                        tone === 'blue' && 'bg-blue-500/15 text-blue-400',
                        tone === 'red' && 'bg-red-500/15 text-red-400',
                        tone === 'green' && 'bg-green-500/15 text-green-400',
                        tone === 'purple' && 'bg-purple-500/15 text-purple-400',
                        tone === 'amber' && 'bg-amber-500/15 text-amber-400',
                        tone === 'cyan' && 'bg-cyan-500/15 text-cyan-400',
                        index === 0 ? 'border-white/50 ring-2 ring-primary/50' : 'border-transparent',
                      )}
                    >
                      {index === 0 && <span className="text-xs">✓</span>}
                    </button>
                  ))}
                  <button className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border bg-[conic-gradient(from_0deg,_#ff0000,_#ffff00,_#00ff00,_#00ffff,_#0000ff,_#ff00ff,_#ff0000)]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-500">
                      <Plus className="size-3" />
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentColors.map((color) => (
                    <span key={color} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-2 py-1 text-xs text-foreground-muted">
                      <span className="size-3 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                      {color}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4 text-xs text-foreground-muted">
                New categories can be prefilled from the current search term, then saved with dimensions, preset colors, or custom recent colors.
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </section>
  )
}
