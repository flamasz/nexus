import { Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { routeGroups, SectionHeading, SurfaceCard } from './shared'

export function SectionShellPatterns() {
  return (
    <section id="shell" className="space-y-6">
      <SectionHeading
        title="Application Shell"
        description="The design system now reflects Nexus’ current information architecture, compact sidebar, and permission-aware header patterns."
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SurfaceCard title="Current route map" eyebrow="Layout">
          <div className="space-y-4">
            {routeGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground-subtle">
                  {group.title}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Badge
                      key={item}
                      variant={item === 'Artwork' ? 'info' : item === 'Orders' ? 'default' : 'outline'}
                      className="rounded-full px-3 py-1 text-[11px]"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Header actions" eyebrow="Interaction">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
                <input
                  readOnly
                  value="Search orders, artwork, and users"
                  className="h-9 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-sm text-foreground-muted outline-none"
                />
              </div>
              <button className="flex h-8 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 pl-3.5 pr-3 text-sm text-primary">
                <span className="flex size-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                  A
                </span>
                Acme Corp
              </button>
            </div>
            <div className="grid gap-2 text-xs text-foreground-muted sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface p-3">
                Organization switching is now a first-class header action.
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                User avatar menus expose settings, admin, and sign-out.
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                Search stays compact and is hidden on smaller screens.
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </section>
  )
}
