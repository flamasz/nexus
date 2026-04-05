'use client';

import { useState, useEffect, useRef } from 'react';

import { OrderBlock } from '@/components/orders';
import { resolveUserAccess } from '@/lib/auth/permissions';
import {
  PurchaseOrderWithItems,
  OrderItemWithDetails,
  ItemName,
  Category,
  User,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { getOrders, createOrder, createOrderItem } from '@/app/actions/orders';
import { getCategories } from '@/app/actions/categories';
import { getItemNames } from '@/app/actions/itemNames';
import { getCurrentUser } from '@/app/actions/users';

export default function OrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [itemNames, setItemNames] = useState<ItemName[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [artworkStatusMap, setArtworkStatusMap] = useState<Record<string, string>>({});
  const [itemStatusMap, setItemStatusMap] = useState<Record<string, string>>({});
  const [itemsIdLookup, setItemsIdLookup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  // Use refs to avoid re-creating the subscription on every orders change
  const ordersRef = useRef<PurchaseOrderWithItems[]>([]);
  const userRef = useRef<User | null>(null);
  ordersRef.current = orders;
  userRef.current = user;

  const refreshArtworkStatus = async (allOrderItems: OrderItemWithDetails[], orgId: string) => {
    const supabase = createClient();
    const combos = allOrderItems.filter((oi) => oi.item_name_id && oi.category_id);
    if (combos.length === 0) return;

    const { data: matchedItems } = await supabase
      .from('items')
      .select('id, item_name_id, category_id, version, status')
      .eq('organization_id', orgId);

    if (!matchedItems) return;

    const lookup: Record<string, string> = {};
    const statusLookup: Record<string, string> = {};
    for (const combo of combos) {
      const match = (matchedItems as { id: string; item_name_id: string; category_id: string; version: string | null; status: string }[]).find(
        (i) =>
          i.item_name_id === combo.item_name_id &&
          i.category_id === combo.category_id &&
          (i.version ?? null) === (combo.version ?? null)
      );
      if (match) {
        const key = `${combo.item_name_id}|${combo.category_id}|${combo.version ?? ''}`;
        lookup[key] = match.id;
        statusLookup[match.id] = match.status;
      }
    }
    setItemsIdLookup(lookup);
    setItemStatusMap(statusLookup);

    const itemIds = [...new Set(Object.values(lookup))];
    if (itemIds.length === 0) return;

    const { data: sessions } = await supabase
      .from('upload_sessions')
      .select('packaging_id, status, uploaded_at')
      .in('packaging_id', itemIds)
      .order('uploaded_at', { ascending: false });

    if (!sessions) return;

    const statusMap: Record<string, string> = {};
    for (const session of sessions as { packaging_id: string; status: string }[]) {
      if (!statusMap[session.packaging_id]) {
        statusMap[session.packaging_id] = session.status;
      }
    }
    setArtworkStatusMap(statusMap);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await getCurrentUser();
        setUser(userData);

        if (!userData?.organization_id) {
          setOrders([]);
          setItemNames([]);
          setCategories([]);
          return;
        }

        const [ordersData, itemNamesData, categoriesData] = await Promise.all([
          getOrders(),
          getItemNames(),
          getCategories(),
        ]);
        setOrders(ordersData);
        setItemNames(itemNamesData);
        setCategories(categoriesData);

        const allOrderItems = ordersData.flatMap((o) => o.order_items);
        await refreshArtworkStatus(allOrderItems, userData.organization_id);
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('orders-upload-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upload_sessions' },
        async () => {
          const allOrderItems = ordersRef.current.flatMap((o) => o.order_items);
          await refreshArtworkStatus(allOrderItems, userRef.current?.organization_id ?? '');
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items' },
        async () => {
          const allOrderItems = ordersRef.current.flatMap((o) => o.order_items);
          await refreshArtworkStatus(allOrderItems, userRef.current?.organization_id ?? '');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    try {
      const newOrder = await createOrder();
      const firstItem = await createOrderItem(newOrder.id);
      const orderWithItems: PurchaseOrderWithItems = { ...newOrder, order_items: [firstItem] };
      setOrders((prev) => [orderWithItems, ...prev]);
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Make sure your organization is set up.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleArchiveOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, archived: !o.archived } : o))
    );
  };

  const handleOrderItemsChange = (orderId: string, items: OrderItemWithDetails[]) => {
    setOrders((prev) => {
      const newOrders = prev.map((o) => (o.id === orderId ? { ...o, order_items: items } : o));
      // Compute allOrderItems from the new state, not the stale closure
      const allOrderItems = newOrders.flatMap((o) => o.order_items);
      refreshArtworkStatus(allOrderItems, user?.organization_id ?? '');
      return newOrders;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-foreground-muted">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-foreground-muted">Not authenticated</div>
      </div>
    );
  }

  const access = resolveUserAccess(user);

  if (!user.organization_id) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 mx-auto text-foreground-subtle mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground mb-2">No organization assigned</h2>
            <p className="text-sm text-foreground-muted">Your account is not linked to an organization. Ask your administrator to assign you to one before using Purchase Orders.</p>
          </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Purchase Orders</h1>
            <div className="flex items-center gap-4">
              {orders.some((o) => o.archived) && (
                <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Show archived
                </label>
              )}
              {access.canCreateOrder && (
                <button
                  onClick={handleCreateOrder}
                  disabled={creatingOrder}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-md transition-colors"
                >
                  {creatingOrder ? 'Creating...' : '+ Create New Order'}
                </button>
              )}
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="bg-surface border border-border rounded-lg p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-foreground-subtle mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h2 className="text-xl font-semibold text-foreground mb-2">No orders yet</h2>
              <p className="text-foreground-muted mb-4">Create your first purchase order to get started.</p>
              {access.canCreateOrder && (
                <button
                  onClick={handleCreateOrder}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium rounded-md transition-colors"
                >
                  Create New Order
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {orders.filter((o) => showArchived || !o.archived).map((order) => (
                <OrderBlock
                  key={order.id}
                  order={order}
                  itemNames={itemNames}
                  categories={categories}
                  access={access}
                  artworkStatusMap={artworkStatusMap}
                  itemStatusMap={itemStatusMap}
                  itemsIdLookup={itemsIdLookup}
                  onDelete={handleDeleteOrder}
                  onArchive={handleArchiveOrder}
                  onOrderItemsChange={handleOrderItemsChange}
                  onCategoriesChange={async () => {
                    const updated = await getCategories();
                    setCategories(updated);
                  }}
                />
              ))}
            </div>
          )}
        </div>
    </main>
  );
}
