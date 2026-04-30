import { NextResponse } from 'next/server';

import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';

interface VersionWithStatus {
  version: string;
  status?: string;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemNameId = searchParams.get('itemNameId');
  const categoryId = searchParams.get('categoryId');

  if (!itemNameId || !categoryId) {
    return NextResponse.json({ error: 'Missing version lookup parameters' }, { status: 400 });
  }

  try {
    const { orgId } = await requireOrganizationContext();
    const supabase = await createClient();
    const [itemsResult, orderItemsResult] = await Promise.all([
      supabase
        .from('items')
        .select('version, status')
        .eq('item_name_id', itemNameId)
        .eq('category_id', categoryId)
        .eq('organization_id', orgId)
        .not('version', 'is', null),
      supabase
        .from('order_items')
        .select('version, purchase_orders!inner(organization_id)')
        .eq('item_name_id', itemNameId)
        .eq('category_id', categoryId)
        .eq('purchase_orders.organization_id', orgId)
        .not('version', 'is', null),
    ]);

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    if (orderItemsResult.error) {
      throw orderItemsResult.error;
    }

    const versionMap = new Map<string, string | undefined>();
    for (const row of itemsResult.data || []) {
      versionMap.set(row.version as string, row.status as string);
    }

    for (const row of orderItemsResult.data || []) {
      const version = row.version as string;
      if (!versionMap.has(version)) {
        versionMap.set(version, undefined);
      }
    }

    const versions: VersionWithStatus[] = [...versionMap.entries()]
      .map(([version, status]) => ({ version, status }))
      .sort((a, b) => a.version.localeCompare(b.version));

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Failed to load order item versions:', error);
    return NextResponse.json({ error: 'Failed to load versions' }, { status: 500 });
  }
}
