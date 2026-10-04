'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { clientCache } from '@/lib/api/cache';
import { fetchAPI } from '@/lib/api/client';
import { formatMoney } from '@/lib/utils';

interface OrderItem {
  id: string;
  variantId?: string;
  productTitle: string;
  variantTitle: string;
  imageUrl?: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  subtotalPrice: { amount: string; currencyCode: string };
  totalPrice: { amount: string; currencyCode: string };
  shippingAddress?: { name?: string; address?: string; city?: string; postalCode?: string };
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const { user, loading, getAuthHeaders, openAuthModal } = useAuth();
  const router = useRouter();

  const cacheKey = user ? `storefront:/orders` : '';
  const initialOrders = cacheKey ? clientCache.get<Order[]>(cacheKey) : null;

  const [orders, setOrders] = useState<Order[]>(initialOrders || []);
  const [fetching, setFetching] = useState(!initialOrders);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setFetching(true);
      setError('');
      try {
        const data = await fetchAPI<Order[]>('/orders', {
          headers: getAuthHeaders(),
        });
        setOrders(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading orders');
      } finally {
        setFetching(false);
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      openAuthModal();
      return;
    }

    if (user) {
      fetchOrders(!!initialOrders);
    }
  }, [user, loading, router, openAuthModal, fetchOrders, initialOrders]);

  if (loading || (fetching && !orders.length)) {
    return (
      <div
        className="account-page-container"
        style={{ textAlign: 'center', padding: '100px 20px' }}
      >
        <p>Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="account-page-container">
      <div className="account-header">
        <h1 className="account-title">My Orders</h1>
        <p className="account-subtitle">View and track all your teamwear and signature orders.</p>
      </div>

      {error && (
        <div className="auth-error-banner" style={{ marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="account-empty-state">
          <svg
            aria-hidden="true"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-grey-dark)"
            strokeWidth="1.5"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h3
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.25rem',
              marginTop: '16px',
              textTransform: 'uppercase',
            }}
          >
            No orders found
          </h3>
          <p style={{ color: 'var(--color-grey-dark)', marginTop: '8px', fontSize: '0.875rem' }}>
            You haven't placed any orders yet. Explore our latest products.
          </p>
          <Link
            href="/products"
            className="btn btn-primary"
            style={{
              marginTop: '24px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span>Explore Products</span>
            <svg
              className="btn-checkout-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => {
            const items = order.items || [];
            const totalItemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
            return (
              <div key={order.id} className="order-card">
                {/* 1. Order Card Header */}
                <div className="order-card-header">
                  <div className="order-card-header-info">
                    <span className="order-number">{order.id}</span>
                    <span className="order-date">Placed on {order.createdAt}</span>
                  </div>
                  <div className="order-card-header-badge">
                    <span className={`order-status-badge status-${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* 2. Order Items List */}
                <div className="order-items-list">
                  {items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.productTitle}
                          width={64}
                          height={64}
                          className="order-item-thumbnail"
                        />
                      ) : (
                        <div
                          className="order-item-thumbnail"
                          style={{ background: 'var(--color-grey-light)' }}
                        />
                      )}
                      <div className="order-item-meta">
                        <h4 className="order-item-title">{item.productTitle}</h4>
                        {item.variantTitle && item.variantTitle !== 'Default Title' && (
                          <p className="order-item-variant">{item.variantTitle}</p>
                        )}
                        <div className="order-item-subline">
                          <span className="order-item-qty">Qty: {item.quantity}</span>
                          <span className="order-item-price-mobile">{formatMoney(item.price)}</span>
                        </div>
                      </div>
                      <div className="order-item-price-desktop">{formatMoney(item.price)}</div>
                    </div>
                  ))}
                </div>

                {/* 3. Order Card Footer */}
                <div className="order-card-footer">
                  <div className="order-card-footer-summary">
                    <span className="order-footer-label">
                      Total ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
                    </span>
                    <strong className="order-total-price">{formatMoney(order.totalPrice)}</strong>
                  </div>
                  <div className="order-card-footer-actions">
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="btn btn-secondary order-view-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>View Order Details</span>
                      <svg
                        className="btn-checkout-arrow"
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
