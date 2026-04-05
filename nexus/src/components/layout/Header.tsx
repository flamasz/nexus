'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { resolveUserAccess } from '@/lib/auth/permissions';
import { User, Organization } from '@/types/database';
import { Search, Bell, ChevronDown, Settings, Shield, LogOut, Check, Menu } from 'lucide-react';
import { switchOrganization } from '@/app/actions/organizations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  user: User | null;
  organization: Organization | null;
  organizations: Organization[];
  onMenuClick?: () => void;
}

export function Header({ user, organization, organizations, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const access = resolveUserAccess(user);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Generate breadcrumb from pathname
  const getBreadcrumb = () => {
    if (pathname === '/') return 'Dashboard';
    const segment = pathname.split('/').filter(Boolean)[0];
    if (segment === 'admin') return 'Admin Panel';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <header className="bg-surface border-b border-border h-14 flex-shrink-0 flex items-center px-4 justify-between">
      {/* Left side - mobile menu + page title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          onClick={onMenuClick}
          className="size-8 flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised rounded-lg transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-foreground font-medium text-sm">{getBreadcrumb()}</span>
      </div>

      {/* Right side - search, sparkle, org dropdown, user avatar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:flex items-center">
          <Search className="absolute left-3 size-4 text-foreground-subtle" />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              'w-52 h-9 pl-9 pr-12 rounded-full text-sm',
              'bg-surface border border-border',
              'text-foreground placeholder:text-foreground-subtle',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
              'transition-all duration-150'
            )}
          />

        </div>

        {/* Notification bell */}
        <button
          className="size-9 flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
        >
          <Bell className="size-5" />
        </button>

        {/* Organization pill */}
        {organization && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 h-8 pl-3.5 pr-3 rounded-full border border-primary/50 bg-primary/10 text-sm hover:bg-primary/20 transition-colors">
                <div className="size-5 rounded bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">
                    {organization.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-primary font-medium hidden md:block">{organization.name}</span>
                <ChevronDown className="size-3.5 text-primary/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48 text-xs">
              {organizations.length <= 1 ? (
                <div className="px-2 py-3 text-center text-foreground-muted">
                  No other organizations
                </div>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs">Organizations</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => {
                        if (org.id !== organization.id) {
                          switchOrganization(org.id);
                        }
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <div className="size-4 rounded bg-primary/20 flex items-center justify-center mr-2">
                        <span className="text-[8px] font-bold text-primary">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="flex-1">{org.name}</span>
                      {org.id === organization.id && (
                        <Check className="size-3.5 text-primary ml-2" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User avatar */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="size-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center hover:bg-primary/30 transition-colors">
                <span className="text-xs font-bold text-primary">
                  {user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {access.canManageUsers && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield className="mr-2 size-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} variant="destructive" className="cursor-pointer">
                <LogOut className="mr-2 size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
