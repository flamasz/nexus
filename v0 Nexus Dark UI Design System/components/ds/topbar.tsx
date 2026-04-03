"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8.5" cy="8.5" r="5.5" /><path d="M15.5 15.5l-3-3" />
    </svg>
  )
}
function IconBell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 2a6 6 0 016 6c0 3 1.5 4 1.5 5H2.5C2.5 12 4 11 4 8a6 6 0 016-6z" />
      <path d="M8 16a2 2 0 004 0" />
    </svg>
  )
}
function IconCommand(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 10h10M5 7H4a2 2 0 000 4h1M15 7h1a2 2 0 010 4h-1M7 5V4a2 2 0 014 0v1M7 15v1a2 2 0 004 0v-1" />
    </svg>
  )
}
function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 8l5 5 5-5" />
    </svg>
  )
}
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  )
}

const pageTitle = "Overview"

interface TopbarProps {
  onToggleSidebar?: () => void
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border glass-strong">
      {/* Hamburger toggle */}
      <button
        onClick={onToggleSidebar}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors shrink-0"
        aria-label="Toggle sidebar"
      >
        <IconMenu className="w-4 h-4" />
      </button>

      {/* Page Title */}
      <span className="hidden md:block text-sm text-foreground font-medium flex-1 min-w-0">
        {pageTitle}
      </span>

      {/* Search */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 w-56",
        searchFocused
          ? "border-primary/60 bg-surface-raised blue-glow-sm"
          : "border-border bg-surface hover:border-border hover:bg-surface-raised"
      )}>
        <IconSearch className="w-3.5 h-3.5 text-foreground-subtle shrink-0" />
        <input
          type="text"
          placeholder="Search..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle outline-none min-w-0"
        />

      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button className="relative w-8 h-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors">
          <IconBell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary border-2 border-background" />
        </button>

        {/* Org selector */}
        <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-raised border border-border transition-colors text-sm text-foreground-muted hover:text-foreground">
          <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">A</span>
          </div>
          <span className="text-xs font-medium">Acme Corp</span>
          <IconChevronDown className="w-3 h-3" />
        </button>

        {/* Avatar */}
        <button className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:border-primary/70 transition-all">
          <span className="text-[10px] font-bold text-primary">JD</span>
        </button>
      </div>
    </header>
  )
}
