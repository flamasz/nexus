"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type NavItem = {
  icon: React.ReactNode
  label: string
  badge?: string | number
  active?: boolean
  href?: string
}

type NavGroup = {
  title?: string
  items: NavItem[]
}

function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="6" height="6" rx="1.5" /><rect x="12" y="2" width="6" height="6" rx="1.5" />
      <rect x="2" y="12" width="6" height="6" rx="1.5" /><rect x="12" y="12" width="6" height="6" rx="1.5" />
    </svg>
  )
}
function IconChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 14l4-4 4 3 4-6 4 3" /><rect x="2" y="16" width="16" height="1.2" rx="0.6" />
    </svg>
  )
}
function IconBox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 2l8 4v8l-8 4-8-4V6l8-4z" /><path d="M10 2v14M2 6l8 4 8-4" />
    </svg>
  )
}
function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="7.5" cy="7" r="2.5" /><path d="M1.5 17c0-3.3 2.7-6 6-6" />
      <circle cx="14" cy="7" r="2.5" /><path d="M18.5 17c0-3.3-2.7-6-6-6" />
    </svg>
  )
}
function IconShoppingCart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1 1h2.5l2 9h9l2-6H5" /><circle cx="8" cy="17" r="1.2" /><circle cx="15" cy="17" r="1.2" />
    </svg>
  )
}
function IconFileText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V8l-4-6z" />
      <path d="M12 2v6h6M7 10h6M7 13h4" />
    </svg>
  )
}
function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.22 3.22l1.42 1.42M15.36 15.36l1.42 1.42M3.22 16.78l1.42-1.42M15.36 4.64l1.42-1.42" />
    </svg>
  )
}
function IconHelpCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10" cy="10" r="8" /><path d="M7.5 7.5a2.5 2.5 0 015 .83c0 1.67-2.5 2.5-2.5 2.5" /><circle cx="10" cy="14.5" r="0.5" fill="currentColor" />
    </svg>
  )
}
function IconWarehouse(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 8l8-5 8 5v9H2V8z" /><rect x="7" y="12" width="6" height="5" rx="1" />
    </svg>
  )
}
function IconDollarSign(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 2v16M14 5.5H8a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H6" />
    </svg>
  )
}
function IconChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M13 4l-6 6 6 6" />
    </svg>
  )
}

const navGroups: NavGroup[] = [
  {
    items: [
      { icon: <IconGrid className="w-4 h-4" />, label: "Dashboard", active: true },
      { icon: <IconChart className="w-4 h-4" />, label: "Analytics" },
    ]
  },
  {
    title: "Operations",
    items: [
      { icon: <IconShoppingCart className="w-4 h-4" />, label: "Orders", badge: 12 },
      { icon: <IconBox className="w-4 h-4" />, label: "Products" },
      { icon: <IconWarehouse className="w-4 h-4" />, label: "Inventory", badge: "Low" },
      { icon: <IconUsers className="w-4 h-4" />, label: "Customers" },
    ]
  },
  {
    title: "Finance",
    items: [
      { icon: <IconDollarSign className="w-4 h-4" />, label: "Billing" },
      { icon: <IconFileText className="w-4 h-4" />, label: "Reports" },
    ]
  },
  {
    title: "System",
    items: [
      { icon: <IconSettings className="w-4 h-4" />, label: "Settings" },
      { icon: <IconHelpCircle className="w-4 h-4" />, label: "Help" },
    ]
  }
]

interface SidebarProps {
  collapsed?: boolean
  onCollapse?: (v: boolean) => void
}

export function Sidebar({ collapsed = false, onCollapse }: SidebarProps) {
  const [activeItem, setActiveItem] = useState("Dashboard")

  return (
    <aside
      className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out",
        "bg-sidebar border-r border-sidebar-border",
        "relative shrink-0",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-4 border-b border-sidebar-border shrink-0",
        collapsed && "justify-center px-0"
      )}>
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 blue-glow-sm">
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-primary-foreground">
            <path d="M10 2L17 6V14L10 18L3 14V6L10 2Z" fill="currentColor" opacity="0.9" />
            <path d="M10 7L14 9.5V14.5L10 17L6 14.5V9.5L10 7Z" fill="white" opacity="0.4" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-none">Nexus</p>
            <p className="text-[10px] text-foreground-muted mt-0.5 leading-none">Enterprise Suite</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.title && !collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle px-2 mb-1.5">
                {group.title}
              </p>
            )}
            {group.title && collapsed && <div className="border-t border-border mx-2 mb-2" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeItem === item.label
                return (
                  <li key={item.label}>
                    <button
                      onClick={() => setActiveItem(item.label)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 group relative",
                        isActive
                          ? "bg-primary-subtle text-primary font-medium blue-glow-sm"
                          : "text-foreground-muted hover:text-foreground hover:bg-surface-raised"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-foreground-subtle group-hover:text-foreground-muted"
                      )}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 text-left leading-none">{item.label}</span>
                      )}
                      {!collapsed && item.badge !== undefined && (
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none",
                          typeof item.badge === 'number'
                            ? "bg-primary text-primary-foreground"
                            : "bg-warning-subtle text-warning"
                        )}>
                          {item.badge}
                        </span>
                      )}
                      {collapsed && item.badge !== undefined && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className={cn(
        "border-t border-sidebar-border p-2 shrink-0",
        collapsed && "flex justify-center"
      )}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">JD</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-surface-raised cursor-pointer transition-colors">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">JD</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground leading-none">Jane Doe</p>
              <p className="text-[10px] text-foreground-muted mt-0.5 leading-none truncate">Admin</p>
            </div>
          </div>
        )}
      </div>

    </aside>
  )
}
