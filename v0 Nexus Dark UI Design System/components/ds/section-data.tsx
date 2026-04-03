"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts"

/* ── Chart Data ── */
const revenueData = [
  { month: "Oct", revenue: 48000, target: 52000 },
  { month: "Nov", revenue: 61000, target: 58000 },
  { month: "Dec", revenue: 79000, target: 70000 },
  { month: "Jan", revenue: 55000, target: 62000 },
  { month: "Feb", revenue: 67000, target: 65000 },
  { month: "Mar", revenue: 84000, target: 76000 },
]

const ordersData = [
  { day: "Mon", orders: 142, returns: 12 },
  { day: "Tue", orders: 198, returns: 8 },
  { day: "Wed", orders: 165, returns: 15 },
  { day: "Thu", orders: 221, returns: 9 },
  { day: "Fri", orders: 284, returns: 20 },
  { day: "Sat", orders: 190, returns: 14 },
  { day: "Sun", orders: 84, returns: 6 },
]

const pieData = [
  { name: "Operations", value: 38, color: "oklch(0.62 0.21 255)" },
  { name: "Finance", value: 22, color: "oklch(0.70 0.16 210)" },
  { name: "Logistics", value: 18, color: "oklch(0.66 0.17 150)" },
  { name: "HR", value: 12, color: "oklch(0.78 0.18 75)" },
  { name: "Other", value: 10, color: "oklch(0.45 0.012 230)" },
]

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-3 py-2.5 text-xs shadow-lg border border-glass-border">
      <p className="text-foreground-muted mb-1.5 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground-muted capitalize">{p.name}:</span>
          <span className="text-foreground font-semibold tabular-nums">
            {typeof p.value === 'number' && p.name === 'revenue' || p.name === 'target'
              ? `$${p.value.toLocaleString()}`
              : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Table Data ── */
const tableData = [
  { id: "ORD-4821", customer: "Acme Corp", product: "Server Rack 42U", qty: 2, amount: "$8,400", status: "Shipped", date: "Mar 28" },
  { id: "ORD-4820", customer: "Globex Ltd", product: "Network Switch 48P", qty: 5, amount: "$12,500", status: "Processing", date: "Mar 28" },
  { id: "ORD-4819", customer: "Initech", product: "UPS 3000VA", qty: 1, amount: "$1,200", status: "Pending", date: "Mar 27" },
  { id: "ORD-4818", customer: "Umbrella Inc", product: "Fiber Patch Panel", qty: 10, amount: "$950", status: "Delivered", date: "Mar 27" },
  { id: "ORD-4817", customer: "Stark Industries", product: "Rack PDU 20A", qty: 4, amount: "$3,200", status: "Failed", date: "Mar 26" },
]

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Shipped: "bg-info-subtle text-info border-info/25",
    Processing: "bg-warning-subtle text-warning border-warning/25",
    Pending: "bg-surface-overlay text-foreground-muted border-border",
    Delivered: "bg-success-subtle text-success border-success/25",
    Failed: "bg-destructive-subtle text-destructive border-destructive/25",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border leading-none", map[status] || map.Pending)}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {status}
    </span>
  )
}

/* ════════════════════════════════
   CHARTS SECTION
════════════════════════════════ */
export function SectionCharts() {
  const [activeArea, setActiveArea] = useState<string | null>(null)

  return (
    <section id="charts" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Data Visualization</h2>
        <p className="text-sm text-foreground-muted mt-1">Recharts-based charts styled for the dark glassmorphism theme.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Area chart — large */}
        <div className="lg:col-span-3 bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Revenue vs Target</h4>
              <p className="text-xs text-foreground-muted mt-0.5">Oct 2025 — Mar 2026</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.62 0.21 255)" }} />
                Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-foreground-subtle/40" />
                Target
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.62 0.21 255)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(0.62 0.21 255)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.012 230)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="oklch(0.55 0.012 230)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.34 0.018 240 / 0.5)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "oklch(0.55 0.012 230)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.55 0.012 230)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="target" stroke="oklch(0.55 0.012 230)" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#colorTarget)" />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.62 0.21 255)" strokeWidth={2} fill="url(#colorRevenue)" dot={{ fill: "oklch(0.62 0.21 255)", strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: "oklch(0.62 0.21 255)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="lg:col-span-2 bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-foreground">Budget by Dept</h4>
            <p className="text-xs text-foreground-muted mt-0.5">Q1 2026 allocation</p>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-foreground-muted flex-1">{d.name}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Daily Orders & Returns</h4>
            <p className="text-xs text-foreground-muted mt-0.5">This week</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.62 0.21 255)" }} />
              Orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.60 0.22 25)" }} />
              Returns
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ordersData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.34 0.018 240 / 0.5)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "oklch(0.55 0.012 230)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "oklch(0.55 0.012 230)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="orders" fill="oklch(0.62 0.21 255)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="returns" fill="oklch(0.60 0.22 25 / 0.7)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

/* ════════════════════════════════
   TABLE SECTION
════════════════════════════════ */
export function SectionTable() {
  const [sortField, setSortField] = useState<string>("id")
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedRows.size === tableData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(tableData.map(r => r.id)))
    }
  }

  const SortIcon = ({ field }: { field: string }) => (
    <svg viewBox="0 0 16 16" className={cn("w-3 h-3 transition-colors", sortField === field ? "text-primary" : "text-foreground-subtle")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M8 3v10M5 6l3-3 3 3M5 10l3 3 3-3" />
    </svg>
  )

  return (
    <section id="tables" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Data Tables</h2>
        <p className="text-sm text-foreground-muted mt-1">Sortable, selectable rows with inline status badges and compact density.</p>
      </div>

      <div className="bg-surface-raised rounded-2xl border border-border card-shadow overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">Recent Orders</h4>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary-subtle text-primary border border-primary/20">
              {tableData.length} rows
            </span>
            {selectedRows.size > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-warning-subtle text-warning border border-warning/20">
                {selectedRows.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-foreground-muted hover:text-foreground bg-surface hover:bg-surface-overlay border border-border transition-colors">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12M4 8h8M6 12h4" />
              </svg>
              Filter
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-foreground-muted hover:text-foreground bg-surface hover:bg-surface-overlay border border-border transition-colors">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v10M4 8l4 4 4-4M2 14h12" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-10 px-4 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === tableData.length}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                  />
                </th>
                {["Order ID", "Customer", "Product", "Qty", "Amount", "Status", "Date"].map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left cursor-pointer select-none"
                    onClick={() => setSortField(col.toLowerCase())}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle hover:text-foreground-muted transition-colors">
                        {col}
                      </span>
                      <SortIcon field={col.toLowerCase()} />
                    </div>
                  </th>
                ))}
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/50 last:border-0 transition-colors cursor-pointer group",
                    selectedRows.has(row.id) ? "bg-primary-subtle" : "hover:bg-surface-overlay/60"
                  )}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-primary font-semibold">{row.id}</td>
                  <td className="px-3 py-2.5 text-foreground font-medium">{row.customer}</td>
                  <td className="px-3 py-2.5 text-foreground-muted max-w-[160px] truncate">{row.product}</td>
                  <td className="px-3 py-2.5 text-foreground-muted tabular-nums">{row.qty}</td>
                  <td className="px-3 py-2.5 text-foreground font-semibold tabular-nums">{row.amount}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={row.status} /></td>
                  <td className="px-3 py-2.5 text-foreground-muted text-xs">{row.date}</td>
                  <td className="px-3 py-2.5">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center text-foreground-subtle hover:text-foreground hover:bg-surface-overlay">
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                        <circle cx="8" cy="3" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="13" r="1.2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-foreground-muted">Showing 5 of 1,284 orders</p>
          <div className="flex items-center gap-1">
            {["‹", "1", "2", "3", "...", "24", "›"].map((p, i) => (
              <button
                key={i}
                className={cn(
                  "w-7 h-7 rounded-lg text-xs font-medium transition-colors",
                  p === "1"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-overlay"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════
   MISC COMPONENTS
════════════════════════════════ */
export function SectionMisc() {
  const [progress] = useState(68)
  const [tab, setTab] = useState("overview")

  return (
    <section id="misc" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Misc Components</h2>
        <p className="text-sm text-foreground-muted mt-1">Progress bars, alerts, tabs, tooltips and more.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progress */}
        <div className="bg-surface-raised rounded-2xl p-5 border border-border card-shadow space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Progress Bars</h4>
          {[
            { label: "Revenue Target", value: 84, color: "bg-primary" },
            { label: "Inventory Fill", value: 56, color: "bg-info" },
            { label: "Support SLA", value: 92, color: "bg-success" },
            { label: "Budget Used", value: 71, color: "bg-warning" },
            { label: "Error Rate", value: 23, color: "bg-destructive" },
          ].map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-foreground-muted">{bar.label}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{bar.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", bar.color)}
                  style={{ width: `${bar.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Alerts */}
        <div className="bg-surface-raised rounded-2xl p-5 border border-border card-shadow space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Alert States</h4>
          {[
            { type: "info", icon: "ℹ", label: "System update scheduled for Sunday 02:00 UTC.", cls: "border-info/30 bg-info-subtle text-info" },
            { type: "success", icon: "✓", label: "Batch import completed. 482 records processed.", cls: "border-success/30 bg-success-subtle text-success" },
            { type: "warning", icon: "⚠", label: "Low stock alert: 3 products below reorder point.", cls: "border-warning/30 bg-warning-subtle text-warning" },
            { type: "error", icon: "✕", label: "Payment gateway timeout. Retrying automatically.", cls: "border-destructive/30 bg-destructive-subtle text-destructive" },
          ].map((alert) => (
            <div key={alert.type} className={cn("flex items-start gap-3 p-3 rounded-xl border text-xs font-medium", alert.cls)}>
              <span className="shrink-0 font-bold">{alert.icon}</span>
              <span className="flex-1 leading-relaxed">{alert.label}</span>
              <button className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">✕</button>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
          <h4 className="text-sm font-semibold text-foreground mb-4">Tab Navigation</h4>
          <div className="flex gap-1 p-1 rounded-xl bg-surface w-fit mb-5">
            {["overview", "activity", "settings"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                  tab === t
                    ? "bg-primary text-primary-foreground blue-glow-sm"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-xs text-foreground-muted bg-surface rounded-xl px-4 py-3 border border-border">
            <span className="capitalize font-semibold text-foreground">{tab}</span> panel content renders here.
          </div>
        </div>

        {/* Avatars & Presence */}
        <div className="bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
          <h4 className="text-sm font-semibold text-foreground mb-4">Avatars & Presence</h4>
          <div className="space-y-4">
            {/* Stacked */}
            <div>
              <p className="text-xs text-foreground-muted mb-2">Stacked group</p>
              <div className="flex -space-x-2">
                {["JD", "EW", "CM", "PN", "JK"].map((initials, i) => (
                  <div
                    key={initials}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      zIndex: 5 - i,
                      backgroundColor: "oklch(0.32 0.08 255)",
                      border: "1px solid oklch(0.50 0.12 255 / 0.5)",
                    }}
                  >
                    <span className="text-[9px] font-bold text-primary">{initials}</span>
                  </div>
                ))}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    zIndex: 0,
                    backgroundColor: "oklch(0.28 0.04 240)",
                    border: "1px solid oklch(0.45 0.05 240 / 0.5)",
                  }}
                >
                  <span className="text-[9px] font-semibold text-foreground-muted">+8</span>
                </div>
              </div>
            </div>

            {/* With presence */}
            <div>
              <p className="text-xs text-foreground-muted mb-2">Online presence</p>
              <div className="flex gap-3">
                {[
                  { initials: "JD", online: true },
                  { initials: "EW", online: true },
                  { initials: "CM", online: false },
                  { initials: "PN", online: true },
                ].map(({ initials, online }) => (
                  <div key={initials} className="relative">
                    <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{initials}</span>
                    </div>
                    <span className={cn(
                      "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-raised",
                      online ? "bg-success" : "bg-foreground-subtle"
                    )} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
