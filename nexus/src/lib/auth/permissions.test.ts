import { describe, expect, it } from 'vitest';

import { resolveUserAccess } from './permissions';
import { User } from '@/types/database';

const baseUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  display_name: 'Test User',
  role: 'user',
  organization_id: 'org-1',
  permissions: null,
  permissions_version: 1,
  permissions_updated_at: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

describe('resolveUserAccess invoice permissions', () => {
  it('grants all invoice capabilities to admins', () => {
    const access = resolveUserAccess({ ...baseUser, role: 'admin' });

    expect(access.canViewInvoices).toBe(true);
    expect(access.canCreateInvoices).toBe(true);
    expect(access.canEditInvoices).toBe(true);
    expect(access.canDeleteInvoices).toBe(true);
    expect(access.canAssignInvoices).toBe(true);
  });

  it('grants invoice defaults to purchasers', () => {
    const access = resolveUserAccess({
      ...baseUser,
      permissions: {
        functionalRoles: { purchaser: true, vendor: false, designer: 'disabled' },
        overrides: {},
      },
    });

    expect(access.canViewInvoices).toBe(true);
    expect(access.canCreateInvoices).toBe(true);
    expect(access.canEditInvoices).toBe(true);
    expect(access.canDeleteInvoices).toBe(true);
    expect(access.canAssignInvoices).toBe(true);
  });

  it('keeps vendor/designer-only users out of invoice capabilities by default', () => {
    const access = resolveUserAccess({
      ...baseUser,
      permissions: {
        functionalRoles: { purchaser: false, vendor: true, designer: 'edit' },
        overrides: {},
      },
    });

    expect(access.canViewInvoices).toBe(false);
    expect(access.canCreateInvoices).toBe(false);
    expect(access.canEditInvoices).toBe(false);
    expect(access.canDeleteInvoices).toBe(false);
    expect(access.canAssignInvoices).toBe(false);
  });

  it('allows overrides but does not allow assign without view', () => {
    const access = resolveUserAccess({
      ...baseUser,
      permissions: {
        functionalRoles: { purchaser: false, vendor: false, designer: 'disabled' },
        overrides: {
          viewInvoices: false,
          assignInvoices: true,
        },
      },
    });

    expect(access.canViewInvoices).toBe(false);
    expect(access.canAssignInvoices).toBe(false);
  });
});
