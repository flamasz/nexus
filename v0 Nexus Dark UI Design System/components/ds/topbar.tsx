"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Check, ChevronDown, LogOut, Menu, Search, Settings, Shield } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface TopbarProps {
  onToggleSidebar?: () => void
  pageTitle?: string
}

const organizations = ['Acme Corp', 'Pacific Print', 'Island Supply']

export function Topbar({
  onToggleSidebar,
  pageTitle = 'Design System',
}: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const activeOrganization = organizations[0]

  return (
    <header className="bg-surface border-b border-border h-14 shrink-0 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="size-8 flex items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-medium text-foreground">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:flex items-center">
          <Search className="absolute left-3 size-4 text-foreground-subtle" />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              'h-9 w-52 rounded-full border bg-surface pl-9 pr-12 text-sm transition-all duration-150 outline-none',
              'text-foreground placeholder:text-foreground-subtle',
              searchFocused
                ? 'border-primary/50 ring-2 ring-primary/20'
                : 'border-border hover:bg-surface-raised',
            )}
          />
        </div>

        <button className="size-9 flex items-center justify-center text-foreground-muted transition-colors hover:text-foreground">
          <Bell className="size-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-full border border-primary/50 bg-primary/10 pl-3.5 pr-3 text-sm transition-colors hover:bg-primary/20">
              <div className="size-5 rounded bg-primary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">
                  {activeOrganization.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden md:block text-primary font-medium">{activeOrganization}</span>
              <ChevronDown className="size-3.5 text-primary/70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 text-xs">
            <DropdownMenuLabel className="text-xs">Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((organization) => (
              <DropdownMenuItem key={organization} className="cursor-pointer text-xs">
                <div className="mr-2 size-4 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-primary">
                    {organization.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="flex-1">{organization}</span>
                {organization === activeOrganization && (
                  <Check className="ml-2 size-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="size-9 rounded-full border border-primary/30 bg-primary/20 flex items-center justify-center transition-colors hover:bg-primary/30">
              <span className="text-xs font-bold text-primary">JD</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Jane Doe</p>
                <p className="text-xs text-muted-foreground">jane@nexus.app</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="#admin" className="cursor-pointer">
                <Settings className="mr-2 size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#admin" className="cursor-pointer">
                <Shield className="mr-2 size-4" />
                Admin Panel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="cursor-pointer">
              <LogOut className="mr-2 size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
