import { OrdersClient } from '@/components/orders/OrdersClient';
import { PurchaseOrderWithItems, ItemName, Category, User } from '@/types/database';
import { getOrders } from '@/app/actions/orders';
import { getCategories } from '@/app/actions/categories';
import { getItemNames } from '@/app/actions/itemNames';
import { getCurrentUser } from '@/app/actions/users';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  let user: User | null = null;
  let orders: PurchaseOrderWithItems[] = [];
  let itemNames: ItemName[] = [];
  let categories: Category[] = [];

  try {
    user = await getCurrentUser();

    if (user?.organization_id) {
      [orders, itemNames, categories] = await Promise.all([
        getOrders(),
        getItemNames(),
        getCategories(),
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
    />
  );
}
