"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/ds/sidebar"
import { Topbar } from "@/components/ds/topbar"
import { SectionTokens } from "@/components/ds/section-tokens"
import { SectionButtons, SectionBadges, SectionInputs, SectionCards } from "@/components/ds/section-components"
import { SectionCharts, SectionTable, SectionMisc } from "@/components/ds/section-data"

const navItems = [
  { id: "tokens", label: "Foundations", icon: PaletteIcon },
  { id: "buttons", label: "Buttons", icon: CursorIcon },
  { id: "badges", label: "Badges", icon: TagIcon },
  { id: "inputs", label: "Form Controls", icon: InputIcon },
  { id: "cards", label: "Cards & Panels", icon: LayersIcon },
  { id: "charts", label: "Charts", icon: ChartIcon },
  { id: "tables", label: "Tables", icon: TableIcon },
  { id: "misc", label: "Misc", icon: GridIcon },
]

export default function DesignSystemPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState("tokens")

  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* App Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onToggleSidebar={() => setSidebarCollapsed((v) => !v)} />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Design System Nav */}
          <aside className="hidden lg:flex flex-col w-48 shrink-0 border-r border-border bg-surface overflow-y-auto py-4 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle px-2 mb-3">
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
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left",
                      activeSection === item.id
                        ? "bg-primary-subtle text-primary"
                        : "text-foreground-muted hover:text-foreground hover:bg-surface-raised"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </nav>

            {/* Version badge */}
            <div className="mt-auto pt-4 px-2">
              <div className="p-3 rounded-xl bg-surface-raised border border-border">
                <p className="text-[10px] font-semibold text-foreground leading-none">Nexus DS</p>
                <p className="text-[10px] text-foreground-muted mt-1">v1.0.0 — 2026</p>
                <div className="mt-2 flex gap-1">
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-success-subtle text-success border border-success/25">Stable</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto p-6 space-y-16 min-w-0">
            {/* Hero banner */}
            <div className="relative rounded-2xl overflow-hidden border border-border p-8">
              <div
                className="absolute inset-0"
                style={{
                  background: "radial-gradient(ellipse 80% 60% at 60% 40%, oklch(0.62 0.21 255 / 0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 50% at 20% 60%, oklch(0.70 0.16 210 / 0.08) 0%, transparent 70%)"
                }}
              />
              <div className="relative flex items-start justify-between gap-6 flex-wrap">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-subtle text-primary border border-primary/25">
                      Design System
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-overlay text-foreground-muted border border-border">
                      v1.0.0
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold text-foreground text-balance mb-3 leading-tight">
                    Nexus ERP<br />
                    <span className="text-primary">Design System</span>
                  </h1>
                  <p className="text-sm text-foreground-muted leading-relaxed text-pretty">
                    A comprehensive, dark-themed UI kit for internal enterprise dashboards. Built on dark slate, electric blue, and glassmorphism — with every component you need to ship fast.
                  </p>
                </div>
                <div className="flex flex-col gap-3 shrink-0">
                  {[
                    { value: "50+", label: "Components" },
                    { value: "12", label: "Color tokens" },
                    { value: "7", label: "Radius steps" },
                  ].map((s) => (
                    <div key={s.label} className="glass rounded-xl px-4 py-2 text-center min-w-[80px]">
                      <p className="text-xl font-bold text-primary leading-none">{s.value}</p>
                      <p className="text-[10px] text-foreground-muted mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sections */}
            <SectionTokens />
            <SectionButtons />
            <SectionBadges />
            <SectionInputs />
            <SectionCards />
            <SectionCharts />
            <SectionTable />
            <SectionMisc />

            {/* Footer spacer */}
            <div className="h-8" />
          </main>
        </div>
      </div>
    </div>
  )
}

/* ── Nav Icons ── */
function PaletteIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="8" r="6" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" /><circle cx="10.5" cy="5.5" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" /></svg>
}
function CursorIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 2l10 5-5 1.5L6.5 14 3 2z" /></svg>
}
function TagIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 2h5l7 7-5 5-7-7V2z" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" /></svg>
}
function InputIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="1" y="5" width="14" height="6" rx="2" /><path d="M5 8h6" /></svg>
}
function LayersIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 1l7 4-7 4-7-4 7-4z" /><path d="M1 9l7 4 7-4" /><path d="M1 13l7 4 7-4" /></svg>
}
function ChartIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12l3-4 3 2 3-5 3 3" /></svg>
}
function TableIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="1" y="2" width="14" height="12" rx="2" /><path d="M1 6h14M6 6v8" /></svg>
}
function GridIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="1" y="1" width="5" height="5" rx="1" /><rect x="10" y="1" width="5" height="5" rx="1" /><rect x="1" y="10" width="5" height="5" rx="1" /><rect x="10" y="10" width="5" height="5" rx="1" /></svg>
}
