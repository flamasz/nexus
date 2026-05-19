import type { Viewport } from 'next';
import { OrdersClient } from '@/components/orders/OrdersClient';
import { PurchaseOrderWithItems, ItemName, Category, User, InvoiceOption } from '@/types/database';
import { getOrders } from '@/app/actions/orders';
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
  let itemNames: ItemName[] = [];
  let categories: Category[] = [];
  let invoiceOptions: InvoiceOption[] = [];

  try {
    user = await getCurrentUser();

    if (user?.organization_id) {
      const access = resolveUserAccess(user);
      [orders, itemNames, categories, invoiceOptions] = await Promise.all([
        getOrders(),
        getItemNames(),
        getCategories(),
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
      initialInvoiceOptions={invoiceOptions}
    />
  );
}
