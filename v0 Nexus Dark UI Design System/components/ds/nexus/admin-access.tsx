import { Shield, UserCog } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { RoleToggleCard, SectionHeading, SurfaceCard, users } from './shared'

export function SectionAdminAccess() {
  return (
    <section id="admin" className="space-y-6">
      <SectionHeading
        title="Admin Access Patterns"
        description="The admin surface has evolved into a permissions editor with role summaries, password actions, and granular workflow toggles."
      />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard title="User access summary" eyebrow="Admin">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="grid grid-cols-[1.2fr_1.1fr_0.7fr_0.7fr] gap-3 border-b border-border bg-surface-raised px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
              <span>User</span>
              <span>Roles & access</span>
              <span>Joined</span>
              <span className="text-right">Actions</span>
            </div>
            {users.map((user) => (
              <div key={user.email} className="grid grid-cols-[1.2fr_1.1fr_0.7fr_0.7fr] gap-3 border-b border-border px-4 py-4 text-sm last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-foreground-muted">{user.email}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                        user.role === 'Admin'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-surface-overlay text-foreground-muted',
                      )}
                    >
                      {user.role}
                    </span>
                    {user.labels.map((label) => (
                      <span key={label} className="inline-flex rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
                        {label}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-foreground-subtle">{user.access}</p>
                </div>
                <div className="text-foreground-muted">{user.joined}</div>
                <div className="flex flex-col items-end gap-2 text-primary">
                  <button>Edit access</button>
                  <button>Change password</button>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Permission editor" eyebrow="Granular controls">
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/25 bg-primary-subtle/60 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="size-4" />
                <p className="text-sm font-semibold">Effective access preview</p>
              </div>
              <p className="mt-2 text-xs text-foreground-muted">
                Admin access, artwork approvals, upload management, and catalog editing are grouped into a single review surface before saving.
              </p>
            </div>

            <RoleToggleCard title="Admin role" description="Unlock organization switching, user management, and global settings access." checked />
            <RoleToggleCard title="Designer enabled" description="Expose artwork workspace, upload review, and approval workflow UI." checked />
            <RoleToggleCard title="Manage upload status" description="Allow approve / reject transitions directly from upload session cards." checked />
            <RoleToggleCard title="Manage catalog" description="Create and edit categories, item names, and product lines inline." checked={false} />

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <UserCog className="size-4 text-primary" />
                Change password modal
              </div>
              <Badge variant="info">6+ characters required</Badge>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </section>
  )
}
