"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

/* ── Sub-section wrapper ── */
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className="bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
        {children}
      </div>
    </div>
  )
}

/* ── Flat Icons ── */
function IconPlus(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" {...p}><path d="M10 4v12M4 10h12" /></svg>
}
function IconDownload(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 3v10M6 9l4 4 4-4M3 17h14" /></svg>
}
function IconRefresh(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10a6 6 0 0112 0M4 10l-2-2m2 2l2-2M16 10l2 2m-2-2l-2 2" /></svg>
}
function IconTrash(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 5h14M8 5V3h4v2M6 5v11a1 1 0 001 1h6a1 1 0 001-1V5" /></svg>
}
function IconChevronRight(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 4l6 6-6 6" /></svg>
}
function IconCheck(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10l4 4 8-8" /></svg>
}
function IconUser(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="10" cy="7" r="3" /><path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
}
function IconMail(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="4" width="16" height="12" rx="2" /><path d="M2 7l8 5 8-5" /></svg>
}
function IconEye(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 10s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" /><circle cx="10" cy="10" r="2.5" /></svg>
}
function IconEyeOff(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3l14 14M8.4 8.5A3 3 0 0013 13M6 5.6C3.6 7 2 9.8 2 10s3.6 7 8 7c1.6 0 3-.5 4.2-1.3" /><path d="M17.8 13C18.8 11.7 19 10.3 19 10c0 0-3.6-7-8-7-.5 0-1 0-1.5.1" /></svg>
}
function IconSearch(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8.5" cy="8.5" r="5.5" /><path d="M15.5 15.5l-3-3" /></svg>
}

/* ════════════════════════════════
   BUTTONS
════════════════════════════════ */
export function SectionButtons() {
  const [loading, setLoading] = useState(false)

  return (
    <section id="buttons" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Buttons</h2>
        <p className="text-sm text-foreground-muted mt-1">Interactive controls with consistent rounded geometry and accessible states.</p>
      </div>

      {/* Variants */}
      <SubSection title="Variants">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover active:bg-primary-active transition-colors blue-glow-sm">
            Primary
          </button>
          <button className="px-4 py-2 rounded-xl bg-surface-overlay text-foreground text-sm font-medium hover:bg-surface-overlay/80 border border-border transition-colors">
            Secondary
          </button>
          <button className="px-4 py-2 rounded-xl border border-primary/50 text-primary text-sm font-medium hover:bg-primary-subtle transition-colors">
            Outline
          </button>
          <button className="px-4 py-2 rounded-xl text-foreground-muted text-sm font-medium hover:text-foreground hover:bg-surface-overlay transition-colors">
            Ghost
          </button>
          <button className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            Destructive
          </button>
          <button className="px-4 py-2 rounded-xl bg-success/20 text-success text-sm font-medium border border-success/30 hover:bg-success/30 transition-colors">
            Success
          </button>
        </div>
      </SubSection>

      {/* Sizes */}
      <SubSection title="Sizes">
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors">
            Extra Small
          </button>
          <button className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors">
            Small
          </button>
          <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors blue-glow-sm">
            Medium
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors blue-glow">
            Large
          </button>
          <button className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary-hover transition-colors blue-glow">
            XL
          </button>
        </div>
      </SubSection>

      {/* With Icons */}
      <SubSection title="With Icons">
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors blue-glow-sm">
            <IconPlus className="w-4 h-4" />
            New Order
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-foreground-muted text-sm font-medium hover:text-foreground hover:bg-surface-raised transition-colors">
            <IconDownload className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-foreground-muted text-sm font-medium hover:text-foreground hover:bg-surface-raised transition-colors">
            <IconRefresh className="w-4 h-4" />
            Sync
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/15 text-destructive text-sm font-medium border border-destructive/30 hover:bg-destructive/25 transition-colors">
            <IconTrash className="w-4 h-4" />
            Delete
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
            Continue
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>
      </SubSection>

      {/* States */}
      <SubSection title="States">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000) }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60 transition-all min-w-[120px] justify-center"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Processing
              </>
            ) : (
              <>
                <IconCheck className="w-4 h-4" />
                Submit
              </>
            )}
          </button>
          <button disabled className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium opacity-40 cursor-not-allowed">
            Disabled
          </button>
          <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium ring-2 ring-primary ring-offset-2 ring-offset-background">
            Focused
          </button>

          {/* Icon-only */}
          <button className="w-9 h-9 rounded-xl bg-surface-overlay border border-border flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-overlay/80 transition-colors">
            <IconPlus className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary-hover transition-colors blue-glow-sm">
            <IconPlus className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary-hover transition-colors blue-glow-sm">
            <IconPlus className="w-4 h-4" />
          </button>
        </div>
      </SubSection>
    </section>
  )
}

/* ════════════════════════════════
   BADGES
════════════════════════════════ */
export function SectionBadges() {
  return (
    <section id="badges" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Badges & Tags</h2>
        <p className="text-sm text-foreground-muted mt-1">Status indicators, labels, and count chips.</p>
      </div>

      <SubSection title="Status Badges">
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Active", cls: "bg-success-subtle text-success border border-success/25" },
            { label: "Pending", cls: "bg-warning-subtle text-warning border border-warning/25" },
            { label: "Failed", cls: "bg-destructive-subtle text-destructive border border-destructive/25" },
            { label: "Processing", cls: "bg-info-subtle text-info border border-info/25" },
            { label: "Draft", cls: "bg-surface-overlay text-foreground-muted border border-border" },
            { label: "Archived", cls: "bg-surface-overlay text-foreground-subtle border border-border" },
          ].map((b) => (
            <span key={b.label} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold leading-none", b.cls)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
              {b.label}
            </span>
          ))}
        </div>
      </SubSection>

      <SubSection title="Pill Tags">
        <div className="flex flex-wrap gap-2">
          {["Finance", "Operations", "HR", "Inventory", "CRM", "Logistics", "Procurement"].map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-subtle text-primary border border-primary/20">
              {tag}
            </span>
          ))}
        </div>
      </SubSection>

      <SubSection title="Count Badges">
        <div className="flex flex-wrap items-center gap-5">
          {[
            { label: "Orders", count: 12, cls: "bg-primary text-primary-foreground" },
            { label: "Alerts", count: 3, cls: "bg-destructive text-destructive-foreground" },
            { label: "Updates", count: 8, cls: "bg-warning text-background" },
            { label: "New", count: 24, cls: "bg-success text-background" },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="text-sm text-foreground-muted">{b.label}</span>
              <span className={cn("min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center leading-none", b.cls)}>
                {b.count}
              </span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Priority Levels">
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Critical", bg: "bg-destructive", dot: "bg-destructive" },
            { label: "High", bg: "bg-warning-subtle text-warning border border-warning/25", dot: "bg-warning" },
            { label: "Medium", bg: "bg-info-subtle text-info border border-info/25", dot: "bg-info" },
            { label: "Low", bg: "bg-surface-overlay text-foreground-muted border border-border", dot: "bg-foreground-subtle" },
          ].map((b) => (
            <span key={b.label} className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold",
              b.label === "Critical" ? "text-destructive-foreground bg-destructive/90" : b.bg
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", b.dot)} />
              {b.label}
            </span>
          ))}
        </div>
      </SubSection>
    </section>
  )
}

/* ════════════════════════════════
   INPUTS
════════════════════════════════ */
export function SectionInputs() {
  const [showPass, setShowPass] = useState(false)

  return (
    <section id="inputs" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Form Controls</h2>
        <p className="text-sm text-foreground-muted mt-1">Inputs, selects, textareas, checkboxes and toggles.</p>
      </div>

      <SubSection title="Text Inputs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Default */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Customer Name</label>
            <input
              type="text"
              placeholder="Enter name..."
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-foreground-subtle outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* With icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Search</label>
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle pointer-events-none" />
              <input
                type="text"
                placeholder="Search records..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-foreground-subtle outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Email</label>
            <div className="relative">
              <IconMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle pointer-events-none" />
              <input
                type="email"
                defaultValue="jane.doe@acme.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-border text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                defaultValue="securepassword"
                className="w-full px-3 pr-10 py-2 rounded-xl bg-surface border border-border text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground-muted transition-colors"
              >
                {showPass ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error state */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">SKU Code</label>
            <input
              type="text"
              defaultValue="XX-??-INVALID"
              className="w-full px-3 py-2 rounded-xl bg-destructive-subtle border border-destructive/50 text-sm text-foreground outline-none focus:ring-2 focus:ring-destructive/20 transition-all"
            />
            <p className="text-xs text-destructive">Invalid SKU format. Use XX-000-AAA.</p>
          </div>

          {/* Disabled */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Account ID</label>
            <input
              type="text"
              disabled
              defaultValue="ACC-00482"
              className="w-full px-3 py-2 rounded-xl bg-surface/50 border border-border/50 text-sm text-foreground-subtle cursor-not-allowed"
            />
            <p className="text-xs text-foreground-subtle">Auto-generated, read-only field.</p>
          </div>
        </div>
      </SubSection>

      <SubSection title="Select & Textarea">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Department</label>
            <select className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer">
              <option>Operations</option>
              <option>Finance</option>
              <option>Logistics</option>
              <option>HR</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Notes</label>
            <textarea
              rows={3}
              placeholder="Add notes about this record..."
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-foreground-subtle outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>
        </div>
      </SubSection>

      <SubSection title="Checkboxes, Radios & Toggles">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Checkboxes */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Checkboxes</p>
            {["Email Notifications", "SMS Alerts", "Push Notifications"].map((label, i) => (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  defaultChecked={i < 2}
                  className="w-4 h-4 rounded bg-surface border border-border checked:bg-primary checked:border-primary accent-primary cursor-pointer"
                />
                <span className="text-sm text-foreground-muted group-hover:text-foreground transition-colors">{label}</span>
              </label>
            ))}
          </div>

          {/* Radios */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Radio Group</p>
            {["Monthly", "Quarterly", "Annual"].map((label, i) => (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="billing"
                  defaultChecked={i === 1}
                  className="w-4 h-4 bg-surface border border-border accent-primary cursor-pointer"
                />
                <span className="text-sm text-foreground-muted group-hover:text-foreground transition-colors">{label}</span>
              </label>
            ))}
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Toggles</p>
            <ToggleRow label="Auto-sync" defaultOn={true} />
            <ToggleRow label="Dark Mode" defaultOn={true} />
            <ToggleRow label="Maintenance" defaultOn={false} />
          </div>
        </div>
      </SubSection>
    </section>
  )
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200",
          "w-10 h-[22px]",
          on ? "bg-primary" : "bg-surface-overlay border border-border"
        )}
      >
        <span
          className="block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: on ? "translateX(22px)" : "translateX(3px)" }}
        />
      </button>
      <span className="text-sm text-foreground-muted group-hover:text-foreground transition-colors">{label}</span>
    </label>
  )
}

/* ════════════════════════════════
   CARDS
════════════════════════════════ */
export function SectionCards() {
  return (
    <section id="cards" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Cards & Panels</h2>
        <p className="text-sm text-foreground-muted mt-1">Glassmorphism containers, stat cards, and list items.</p>
      </div>

      {/* KPI stat cards */}
      <SubSection title="KPI Stat Cards">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Revenue", value: "$284,592", delta: "+12.4%", positive: true, icon: <IconDollarSignSVG />, color: "text-primary bg-primary-subtle border-primary/20" },
            { label: "Orders", value: "1,284", delta: "+8.1%", positive: true, icon: <IconCartSVG />, color: "text-success bg-success-subtle border-success/20" },
            { label: "Customers", value: "4,820", delta: "+3.2%", positive: true, icon: <IconUserSVG />, color: "text-info bg-info-subtle border-info/20" },
            { label: "Returns", value: "38", delta: "-2.1%", positive: false, icon: <IconReturnSVG />, color: "text-destructive bg-destructive-subtle border-destructive/20" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-raised rounded-2xl p-4 border border-border card-shadow inset-highlight">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-xs text-foreground-muted leading-none">{s.label}</p>
                <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center border", s.color)}>
                  {s.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground leading-none mb-1.5">{s.value}</p>
              <span className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded-lg leading-none",
                s.positive ? "text-success bg-success-subtle" : "text-destructive bg-destructive-subtle"
              )}>
                {s.delta}
              </span>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Glass panel */}
      <SubSection title="Glassmorphism Panel">
        <div className="relative rounded-2xl overflow-hidden">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.21 255 / 0.12), oklch(0.70 0.16 210 / 0.08))" }}
          />
          <div className="glass rounded-2xl p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Q1 Performance</h4>
                <p className="text-xs text-foreground-muted mt-0.5">January — March 2026</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success-subtle text-success border border-success/25">
                On Track
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Revenue", value: "$1.2M", sub: "of $1.5M target" },
                { label: "Margin", value: "34.2%", sub: "+2.1% vs last Q" },
                { label: "NPS", value: "72", sub: "Industry avg: 41" },
              ].map((m) => (
                <div key={m.label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="text-xl font-bold text-foreground leading-none">{m.value}</p>
                  <p className="text-[10px] text-foreground-muted mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SubSection>

      {/* List items */}
      <SubSection title="List Items & Rows">
        <div className="space-y-1">
          {[
            { name: "Emma Wilson", role: "Operations Lead", status: "Active", avatar: "EW", amount: "$12,400" },
            { name: "Carlos Mendez", role: "Finance Manager", status: "Active", avatar: "CM", amount: "$9,820" },
            { name: "Priya Nair", role: "Logistics Analyst", status: "Pending", avatar: "PN", amount: "$6,200" },
            { name: "Josh Kim", role: "Procurement", status: "Inactive", avatar: "JK", amount: "$4,100" },
          ].map((row) => (
            <div key={row.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-overlay transition-colors group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">{row.avatar}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-none">{row.name}</p>
                <p className="text-xs text-foreground-muted mt-0.5">{row.role}</p>
              </div>
              <span className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1",
                row.status === "Active" ? "bg-success-subtle text-success border-success/25" :
                row.status === "Pending" ? "bg-warning-subtle text-warning border-warning/25" :
                "bg-surface-overlay text-foreground-muted border-border"
              )}>
                <span className="w-1 h-1 rounded-full bg-current" />
                {row.status}
              </span>
              <span className="text-sm font-semibold text-foreground tabular-nums">{row.amount}</span>
            </div>
          ))}
        </div>
      </SubSection>
    </section>
  )
}

/* ── Inline micro SVG icons for cards ── */
function IconDollarSignSVG() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M10 2v16M14 5.5H8a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H6" /></svg>
}
function IconCartSVG() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h2.5l2 9h9l2-6H5" /><circle cx="8" cy="17" r="1.2" /><circle cx="15" cy="17" r="1.2" /></svg>
}
function IconUserSVG() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="10" cy="7" r="3" /><path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
}
function IconReturnSVG() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h10a4 4 0 010 8H4M4 8l3-3M4 8l3 3" /></svg>
}
