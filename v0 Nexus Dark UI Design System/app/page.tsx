"use client"

import { useState } from 'react'
import {
  ChartColumnIncreasing,
  FileStack,
  FormInput,
  MousePointerClick,
  PackageCheck,
  Palette,
  PanelsTopLeft,
  ShieldCheck,
  Table2,
  Tags,
  Upload,
  Waypoints,
} from 'lucide-react'

import { Sidebar } from '@/components/ds/sidebar'
import {
  SectionAdminAccess,
  SectionOrderWorkflow,
  SectionPackagingWorkspace,
  SectionShellPatterns,
  SectionUploadReview,
} from '@/components/ds/section-nexus-workflows'
import { SectionButtons, SectionBadges, SectionInputs, SectionCards } from '@/components/ds/section-components'
import { SectionCharts, SectionTable } from '@/components/ds/section-data'
import { SectionReuseKit } from '@/components/ds/section-reuse-kit'
import { SectionTokens } from '@/components/ds/section-tokens'
import { Topbar } from '@/components/ds/topbar'
import { cn } from '@/lib/utils'

const navItems = [
  { id: 'reuse', label: 'Reuse Kit', icon: PackageCheck },
  { id: 'tokens', label: 'Foundations', icon: Palette },
  { id: 'shell', label: 'App Shell', icon: Waypoints },
  { id: 'buttons', label: 'Buttons', icon: MousePointerClick },
  { id: 'badges', label: 'Badges', icon: Tags },
  { id: 'inputs', label: 'Form Controls', icon: FormInput },
  { id: 'cards', label: 'Cards & Panels', icon: PanelsTopLeft },
  { id: 'workspace', label: 'Artwork Workspace', icon: FileStack },
  { id: 'orders', label: 'Purchase Orders', icon: FileStack },
  { id: 'uploads', label: 'Upload Review', icon: Upload },
  { id: 'admin', label: 'Admin Access', icon: ShieldCheck },
  { id: 'charts', label: 'Charts', icon: ChartColumnIncreasing },
  { id: 'tables', label: 'Tables', icon: Table2 },
]

export default function DesignSystemPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState('reuse')

  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          pageTitle="Design System"
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-2 py-4 lg:flex">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle">
              Design System
            </p>
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-all',
                      activeSection === item.id
                        ? 'bg-primary-subtle text-primary'
                        : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div className="mt-auto px-2 pt-4">
              <div className="rounded-xl border border-border bg-surface-raised p-3">
                <p className="text-[10px] font-semibold leading-none text-foreground">Nexus DS</p>
                <p className="mt-1 text-[10px] text-foreground-muted">Synced to current Nexus shell and workflows</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-md border border-success/25 bg-success-subtle px-1.5 py-0.5 text-[9px] font-semibold text-success">
                    Live patterns
                  </span>
                  <span className="rounded-md border border-primary/25 bg-primary-subtle px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    Workflow docs
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto p-6 space-y-16">
            <div className="relative overflow-hidden rounded-2xl border border-border p-8">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 80% 60% at 60% 40%, oklch(0.62 0.21 255 / 0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 50% at 20% 60%, oklch(0.70 0.16 210 / 0.08) 0%, transparent 70%)',
                }}
              />
              <div className="relative flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full border border-primary/25 bg-primary-subtle px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Live sync
                    </span>
                    <span className="rounded-full border border-border bg-surface-overlay px-2 py-0.5 text-[10px] font-semibold text-foreground-muted">
                      Nexus purchase-order platform
                    </span>
                  </div>
                  <h1 className="mb-3 text-3xl font-bold leading-tight text-foreground text-balance">
                    Nexus ERP<br />
                    <span className="text-primary">Design System</span>
                  </h1>
                  <p className="text-sm leading-relaxed text-foreground-muted text-pretty">
                    Updated to mirror the current Nexus application shell and workflow components — including the artwork workspace, purchase-order block, upload review surfaces, and admin access controls.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      title: 'Shell parity',
                      body: 'Sidebar and header now follow the live route map and compact controls.',
                    },
                    {
                      title: 'Workflow coverage',
                      body: 'Packaging, uploads, purchase orders, and access editing are documented.',
                    },
                    {
                      title: 'Reusable kit',
                      body: 'Foundations, primitives, shell, and workflow blueprints can be copied into new apps.',
                    },
                    {
                      title: 'Shared semantics',
                      body: 'Category, item-status, and upload-status badges are now first-class components.',
                    },
                  ].map((item) => (
                    <div key={item.title} className="glass min-w-[160px] rounded-xl px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SectionReuseKit />
            <SectionTokens />
            <SectionShellPatterns />
            <SectionButtons />
            <SectionBadges />
            <SectionInputs />
            <SectionCards />
            <SectionPackagingWorkspace />
            <SectionOrderWorkflow />
            <SectionUploadReview />
            <SectionAdminAccess />
            <SectionCharts />
            <SectionTable />

            <div className="h-8" />
          </main>
        </div>
      </div>
    </div>
  )
}
