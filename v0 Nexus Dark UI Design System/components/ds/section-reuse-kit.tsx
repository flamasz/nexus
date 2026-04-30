import { ArrowRight, CheckCircle2, Copy, Layers3, PackageCheck, Route, Workflow } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  nexusAdoptionSteps,
  nexusComponentFamilies,
  nexusDesignSystem,
  nexusRouteGroups,
  nexusWorkflowPatterns,
} from '@/lib/design-system'
import { cn } from '@/lib/utils'

import { SectionHeading, SurfaceCard } from './nexus/shared'

const dependencyGroups = [
  {
    label: 'Core',
    packages: ['next', 'react', 'react-dom', 'tailwindcss', '@tailwindcss/postcss', 'tw-animate-css'],
  },
  {
    label: 'UI primitives',
    packages: ['@radix-ui/*', 'class-variance-authority', 'clsx', 'tailwind-merge', 'lucide-react'],
  },
  {
    label: 'Optional app wiring',
    packages: ['@supabase/ssr', '@supabase/supabase-js', 'resend'],
  },
]

export function SectionReuseKit() {
  return (
    <section id="reuse" className="space-y-6">
      <SectionHeading
        title="Reusable App Starter Kit"
        description="Everything needed to create a new app with the current Nexus visual language: foundations, primitives, shell anatomy, workflow patterns, and copy order. Product data/auth stay outside this kit."
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard title="Package anatomy" eyebrow="Copy kit">
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary-subtle/60 p-4">
              <div className="flex items-center gap-2 text-primary">
                <PackageCheck className="size-4" />
                <p className="text-sm font-semibold">{nexusDesignSystem.name}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
                Treat this directory as a source package: copy the foundations first, then primitives, then the shell, then domain workflow examples. The app-specific Supabase/server-action code remains in Nexus.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {nexusComponentFamilies.map((family) => (
                <div key={family.name} className="rounded-lg border border-border bg-surface p-4">
                  <div className="mb-2 flex items-center gap-2 text-foreground">
                    <Layers3 className="size-4 text-primary" />
                    <p className="text-sm font-semibold">{family.name}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground-muted">{family.purpose}</p>
                  <div className="mt-3 space-y-1.5">
                    {family.copyFiles.map((file) => (
                      <code key={file} className="block rounded-md border border-border bg-surface-raised px-2 py-1 text-[10px] text-foreground-subtle">
                        {file}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Adoption order" eyebrow="Starter checklist">
          <ol className="space-y-3">
            {nexusAdoptionSteps.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceCard title="Route map to reuse" eyebrow="Information architecture">
          <div className="space-y-4">
            {nexusRouteGroups.map((group, groupIndex) => (
              <div key={group.title ?? `group-${groupIndex}`} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground-subtle">
                  {group.title ?? 'Core'}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item.href} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                      <Route className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <Badge
                            variant={item.status === 'live' ? 'success' : 'outline'}
                            className={cn(
                              'rounded-full px-2 py-0 text-[10px]',
                              item.status === 'placeholder' && 'border-border text-foreground-muted',
                            )}
                          >
                            {item.status}
                          </Badge>
                          <code className="text-[10px] text-foreground-subtle">{item.href}</code>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{item.reusablePattern}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Workflow pattern library" eyebrow="Current Nexus app">
          <div className="space-y-3">
            {nexusWorkflowPatterns.map((pattern) => (
              <details key={pattern.name} className="group rounded-lg border border-border bg-surface p-4 open:bg-surface-raised">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <Workflow className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{pattern.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{pattern.reusableAs}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-foreground-subtle transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-4 space-y-3 border-t border-border pt-3">
                  <div className="grid gap-2 text-xs text-foreground-muted md:grid-cols-2">
                    <div className="rounded-md border border-border bg-surface px-3 py-2">
                      <span className="font-semibold text-foreground">Source:</span> {pattern.source}
                    </div>
                    <div className="rounded-md border border-border bg-surface px-3 py-2">
                      <span className="font-semibold text-foreground">Use when:</span> {pattern.includeWhen}
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {pattern.keyBehaviors.map((behavior) => (
                      <li key={behavior} className="flex gap-2 text-xs leading-relaxed text-foreground-muted">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                        {behavior}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {dependencyGroups.map((group) => (
          <SurfaceCard key={group.label} title={group.label} eyebrow="Dependencies">
            <div className="flex flex-wrap gap-2">
              {group.packages.map((pkg) => (
                <span key={pkg} className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground-muted">
                  {pkg}
                </span>
              ))}
            </div>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard title="Starter import surface" eyebrow="Implementation note">
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <Copy className="size-4 text-primary" />
              <p className="text-sm font-semibold">Copy this directory as the design-system package</p>
            </div>
            <p className="text-xs leading-relaxed text-foreground-muted">
              The root index re-exports the manifest and stable primitives so a new app can start with <code className="rounded bg-surface-raised px-1 py-0.5 text-foreground-subtle">nexus-design-system</code> semantics or copy/paste source files directly.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-[11px] leading-relaxed text-foreground-muted">
            <code>{`import { nexusDesignSystem, Button, CategoryBadge } from 'nexus-design-system'

// 1. Import app/globals.css tokens in the new app root.
// 2. Compose Sidebar + Topbar or adapt the route manifest.
// 3. Reuse workflow examples from components/ds/nexus as product blueprints.`}</code>
          </pre>
        </div>
      </SurfaceCard>
    </section>
  )
}
