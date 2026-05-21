import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockConnectionStates, mockItems, mockReferenceData, mockSyncEvents, mockSyncProgress } from '@/lib/businessCentral/mockItems';
import { User } from '@/types/database';
import { ItemsClient } from './ItemsClient';


vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const adminUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  display_name: 'Alex Admin',
  role: 'admin',
  organization_id: 'org-1',
  active_bc_connection_id: null,
  permissions: null,
  permissions_version: 1,
  permissions_updated_at: null,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

afterEach(() => cleanup());

function renderItems(overrides: Partial<React.ComponentProps<typeof ItemsClient>> = {}) {
  return render(
    <ItemsClient
      items={mockItems}
      events={mockSyncEvents}
      connection={mockConnectionStates.configuredOk}
      syncProgress={mockSyncProgress}
      references={mockReferenceData}
      initialUser={adminUser}
      {...overrides}
    />
  );
}

describe('ItemsClient prototype interactions', () => {
  it('edits, saves locally, pushes to BC, and records audit events', () => {
    renderItems({ items: [mockItems[0]], events: [] });

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Edited mock item' } });

    expect(screen.getAllByText('Unsaved').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /save local/i }));
    expect(screen.getAllByText('Unpushed').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /push to bc/i }));
    expect(screen.getAllByText('Unpushed').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /sync & audit/i }));
    expect(screen.getByText('Saved local edits')).toBeInTheDocument();
    expect(screen.queryByText('Pushed local edits to Business Central')).not.toBeInTheDocument();
  });

  it('updates calculated values as numeric fields change', () => {
    renderItems({ items: [mockItems[0]], events: [] });

    fireEvent.click(screen.getByRole('tab', { name: /nexus fields/i }));
    fireEvent.change(screen.getByLabelText('Net weight (g)'), { target: { value: '283.49523125' } });
    expect(screen.getByText('10 oz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /retailer/i }));
    fireEvent.change(screen.getByLabelText('Units per case'), { target: { value: '10' } });
    fireEvent.change(screen.getAllByLabelText('Cases / layer')[0], { target: { value: '2' } });
    fireEvent.change(screen.getAllByLabelText('Layers / pallet')[0], { target: { value: '3' } });
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('submits create without adding a fake local draft id', () => {
    renderItems({ items: [mockItems[0]], events: [] });

    fireEvent.click(screen.getByRole('button', { name: /create item/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('BC item number'), { target: { value: 'ZZ-TEST-100' } });
    fireEvent.change(within(dialog).getByLabelText('Display name'), { target: { value: 'ZZ test item' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /create in business central/i }));

    expect(screen.queryByText('ZZ test item')).not.toBeInTheDocument();
    expect(screen.queryByText('mock-new-001')).not.toBeInTheDocument();
  });

  it('soft-disables Sync Now while local edits are unsynced and shows conflict simulation', () => {
    renderItems({ items: [mockItems[0]], events: [] });

    expect(screen.getByRole('button', { name: /sync now/i })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Dirty item' } });
    expect(screen.getByRole('button', { name: /sync now/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /simulate bc update/i }));
    expect(screen.getAllByText('BC updated while editing').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /sync & audit/i }));
    expect(screen.getByText('Business Central changed while local edits are pending')).toBeInTheDocument();
  });

  it.each([
    ['not_configured', 'Business Central is not connected'],
    ['empty', 'No items synced yet'],
    ['error', 'Connection error'],
    ['loading', 'Loading items'],
  ] as const)('renders the %s state', (_state, expectedText) => {
    const propsByState = {
      not_configured: { connection: mockConnectionStates.notConfigured, items: [], events: [] },
      empty: { items: [], events: [] },
      error: { connection: mockConnectionStates.errorState, items: [], events: [] },
      loading: { isLoading: true, items: [], events: [] },
    } satisfies Record<string, Partial<React.ComponentProps<typeof ItemsClient>>>;

    renderItems(propsByState[_state]);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
