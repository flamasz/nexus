import type { Viewport } from 'next';
import { OrdersClient } from '@/components/orders/OrdersClient';
import { Category, ItemName, PurchaseOrderWithItems, User, InvoiceOption, PackagingItemCombo } from '@/types/database';
import { getOrders, getPackagingItemCombos } from '@/app/actions/orders';
import { getCategories } from '@/app/actions/categories';
import { getItemNames } from '@/app/actions/itemNames';
import { getCurrentUser } from '@/app/actions/users';
import { getInvoiceOptions } from '@/app/actions/invoices';
import { resolveUserAccess } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function OrdersPage() {
  let user: User | null = null;
  let orders: PurchaseOrderWithItems[] = [];
  let invoiceOptions: InvoiceOption[] = [];
  let itemNames: ItemName[] = [];
  let categories: Category[] = [];
  let packagingItemCombos: PackagingItemCombo[] = [];

  try {
    user = await getCurrentUser();

    if (user?.organization_id) {
      const access = resolveUserAccess(user);
      [orders, itemNames, categories, packagingItemCombos, invoiceOptions] = await Promise.all([
        getOrders(),
        getItemNames(),
        getCategories(),
        getPackagingItemCombos(),
        access.canViewInvoices ? getInvoiceOptions() : Promise.resolve([]),
      ]);
    }
  } catch (error) {
    console.error('Failed to load orders:', error);
  }

  return (
    <OrdersClient
      initialUser={user}
      initialOrders={orders}
      initialItemNames={itemNames}
      initialCategories={categories}
      initialPackagingItemCombos={packagingItemCombos}
      initialInvoiceOptions={invoiceOptions}
    />
  );
}
