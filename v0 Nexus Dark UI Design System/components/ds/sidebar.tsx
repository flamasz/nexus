"use client"

import { useState } from 'react'
import {
  BarChart3,
  FileText,
  HelpCircle,
  LayoutGrid,
  Menu,
  Palette,
  Settings,
  ShoppingCart,
  Truck,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  title?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Purchase Orders',
    items: [
      { label: 'Orders', href: '/orders', icon: ShoppingCart },
      { label: 'Artwork', href: '/artwork', icon: Palette },
      { label: 'Invoices', href: '/invoices', icon: FileText },
      { label: 'Shipments', href: '/shipments', icon: Truck },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Help', href: '/help', icon: HelpCircle },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

export function Sidebar({ collapsed = false, onCollapse }: SidebarProps) {
  const [activePath, setActivePath] = useState('/orders')

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-[200px]',
      )}
    >
      <div className="flex items-center border-b border-sidebar-border px-4 py-4 shrink-0">
        <button
          onClick={() => onCollapse?.(!collapsed)}
          className="size-8 shrink-0 rounded-lg text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground flex items-center justify-center"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.title && (
              <div className="relative mb-1 h-6 px-2 flex items-center">
                <p
                  className={cn(
                    'whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-foreground-subtle transition-opacity duration-150',
                    collapsed ? 'opacity-0' : 'opacity-100 delay-150',
                  )}
                >
                  {group.title}
                </p>
                <div
                  className={cn(
                    'absolute inset-x-2 top-1/2 -translate-y-1/2 border-t border-border transition-opacity duration-150',
                    collapsed ? 'opacity-100 delay-150' : 'opacity-0',
                  )}
                />
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = activePath === item.href

                return (
                  <li key={item.href}>
                    <button
                      onClick={() => setActivePath(item.href)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex w-full items-center rounded-xl px-3.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary-subtle text-primary font-medium blue-glow-sm'
                          : 'text-foreground-muted hover:bg-surface-raised hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 transition-colors',
                          isActive
                            ? 'text-primary'
                            : 'text-foreground-subtle group-hover:text-foreground-muted',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-nowrap text-left leading-none overflow-hidden transition-[opacity,margin,width] duration-150',
                          collapsed ? 'ml-0 w-0 opacity-0' : 'ml-2.5 opacity-100 delay-150',
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2 shrink-0">
        <div className="flex items-center px-2 py-2">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 blue-glow-sm">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-primary-foreground">
              <path d="M10 2L17 6V14L10 18L3 14V6L10 2Z" fill="currentColor" opacity="0.9" />
              <path d="M10 7L14 9.5V14.5L10 17L6 14.5V9.5L10 7Z" fill="white" opacity="0.4" />
            </svg>
          </div>
          <div
            className={cn(
              'overflow-hidden whitespace-nowrap transition-[opacity,margin,width] duration-150',
              collapsed ? 'ml-0 w-0 opacity-0' : 'ml-2.5 opacity-100 delay-150',
            )}
          >
            <p className="text-sm font-semibold leading-none text-foreground">Nexus</p>
            <p className="mt-0.5 text-[10px] leading-none text-foreground-muted">
              Enterprise Suite
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
