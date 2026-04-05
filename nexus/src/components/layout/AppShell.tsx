'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppNav } from './AppNav';
import { Header } from './Header';
import { createClient } from '@/lib/supabase/client';
import { User, Organization } from '@/types/database';

interface AppShellProps {
  user: User | null;
  organization: Organization | null;
  organizations: Organization[];
  children: React.ReactNode;
}

export function AppShell({ user, organization, organizations, children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const refreshFingerprint = useMemo(
    () =>
      user
        ? JSON.stringify({
            organization_id: user.organization_id,
            role: user.role,
            permissions_version: user.permissions_version,
            permissions_updated_at: user.permissions_updated_at,
          })
        : null,
    [user]
  );

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    const supabase = createClient();
    let lastFingerprint = refreshFingerprint;
    let cancelled = false;

    const refreshForPermissionChange = (nextFingerprint: string) => {
      if (nextFingerprint === lastFingerprint) {
        return;
      }

      lastFingerprint = nextFingerprint;
      router.refresh();

      if (
        pathname.startsWith('/orders') ||
        pathname.startsWith('/artwork') ||
        pathname.startsWith('/admin')
      ) {
        window.location.reload();
      }
    };

    const checkCurrentUserFingerprint = async () => {
      if (cancelled) {
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('organization_id, role, permissions_version, permissions_updated_at')
        .eq('id', user.id)
        .single();

      if (cancelled || error || !data) {
        return;
      }

      const nextFingerprint = JSON.stringify({
        organization_id: data.organization_id ?? null,
        role: data.role ?? null,
        permissions_version: data.permissions_version ?? null,
        permissions_updated_at: data.permissions_updated_at ?? null,
      });

      refreshForPermissionChange(nextFingerprint);
    };

    const channel = supabase
      .channel(`user-permissions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<User> | null;
          const nextFingerprint = JSON.stringify({
            organization_id: next?.organization_id ?? null,
            role: next?.role ?? null,
            permissions_version: next?.permissions_version ?? null,
            permissions_updated_at: next?.permissions_updated_at ?? null,
          });
          refreshForPermissionChange(nextFingerprint);
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void checkCurrentUserFingerprint();
    }, 2000);

    const handleFocus = () => {
      void checkCurrentUserFingerprint();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [pathname, refreshFingerprint, router, user]);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <AppNav
        user={user}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        onMenuClick={handleToggleSidebar}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header user={user} organization={organization} organizations={organizations} onMenuClick={handleToggleSidebar} />
        {children}
      </div>
    </div>
  );
}
