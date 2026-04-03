import { cn } from "@/lib/utils"

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="text-sm text-foreground-muted mt-1">{description}</p>}
    </div>
  )
}

const colors = [
  { label: "Background", token: "--background", hex: "#1e2130", cls: "bg-background border border-border" },
  { label: "Surface", token: "--surface", hex: "#252b3b", cls: "bg-surface border border-border" },
  { label: "Surface Raised", token: "--surface-raised", hex: "#2d3448", cls: "bg-surface-raised border border-border" },
  { label: "Surface Overlay", token: "--surface-overlay", hex: "#343c52", cls: "bg-surface-overlay border border-border" },
  { label: "Primary", token: "--primary", hex: "#3b82f6", cls: "bg-primary" },
  { label: "Primary Subtle", token: "--primary-subtle", hex: "blue/15", cls: "bg-primary-subtle border border-primary/30" },
  { label: "Success", token: "--success", hex: "#22c55e", cls: "bg-success" },
  { label: "Warning", token: "--warning", hex: "#f59e0b", cls: "bg-warning" },
  { label: "Destructive", token: "--destructive", hex: "#ef4444", cls: "bg-destructive" },
  { label: "Info / Cyan", token: "--info", hex: "#06b6d4", cls: "bg-info" },
]

const radii = [
  { label: "XS", value: "calc(r - 6px)", cls: "rounded-xs" },
  { label: "SM", value: "calc(r - 4px)", cls: "rounded-sm" },
  { label: "MD", value: "calc(r - 2px)", cls: "rounded-md" },
  { label: "LG", value: "r = 0.875rem", cls: "rounded-lg" },
  { label: "XL", value: "calc(r + 4px)", cls: "rounded-xl" },
  { label: "2XL", value: "calc(r + 8px)", cls: "rounded-2xl" },
  { label: "Full", value: "9999px", cls: "rounded-full" },
]

const typeScale = [
  { label: "Display", cls: "text-3xl font-bold", sample: "Dashboard Overview" },
  { label: "Heading 1", cls: "text-2xl font-semibold", sample: "Revenue Analytics" },
  { label: "Heading 2", cls: "text-xl font-semibold", sample: "Order Management" },
  { label: "Heading 3", cls: "text-base font-semibold", sample: "Inventory Status" },
  { label: "Body", cls: "text-sm font-normal leading-relaxed", sample: "The system processed 1,284 orders this month with a 98.2% fulfillment rate." },
  { label: "Small", cls: "text-xs font-normal leading-relaxed", sample: "Last updated 2 minutes ago" },
  { label: "Label", cls: "text-xs font-semibold uppercase tracking-wider", sample: "Section Label" },
  { label: "Mono", cls: "text-sm font-mono", sample: "TXN-00482-AX" },
]

export function SectionTokens() {
  return (
    <section id="tokens" className="space-y-12">
      {/* Colors */}
      <div>
        <SectionHeading
          title="Color Tokens"
          description="Semantic design tokens — all colors are CSS variables mapped through the theme."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {colors.map((c) => (
            <div key={c.token} className="space-y-2">
              <div className={cn("h-14 rounded-xl", c.cls)} />
              <div>
                <p className="text-xs font-medium text-foreground leading-none">{c.label}</p>
                <p className="text-[10px] text-foreground-muted mt-0.5 font-mono">{c.token}</p>
                <p className="text-[10px] text-foreground-subtle font-mono">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <SectionHeading
          title="Border Radius"
          description="Heavily rounded corners — base radius is 0.875rem with scale steps."
        />
        <div className="flex flex-wrap gap-4">
          {radii.map((r) => (
            <div key={r.label} className="flex flex-col items-center gap-2">
              <div className={cn("w-12 h-12 bg-primary-subtle border border-primary/30", r.cls)} />
              <div className="text-center">
                <p className="text-[11px] font-semibold text-foreground">{r.label}</p>
                <p className="text-[10px] text-foreground-muted font-mono">{r.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <SectionHeading
          title="Typography Scale"
          description="Inter for UI text — clean, compact, highly legible at all sizes."
        />
        <div className="space-y-5 bg-surface-raised rounded-2xl p-5 border border-border card-shadow">
          {typeScale.map((t) => (
            <div key={t.label} className="flex items-baseline gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
              <span className="text-[10px] text-foreground-subtle font-mono w-20 shrink-0 pt-0.5 uppercase tracking-wider">
                {t.label}
              </span>
              <span className={cn("text-foreground leading-none", t.cls, t.label === "Mono" && "font-mono")}>
                {t.sample}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
