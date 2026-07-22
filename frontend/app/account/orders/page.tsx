'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api/client';

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

  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
      openAuthModal('login');
      return;
    }

    if (user) {
      fetchOrders();
    }
  }, [user, loading, router, openAuthModal]);

  const fetchOrders = async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/orders`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to load order history');
      }
      const data = await res.json();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Error loading orders');
    } finally {
      setFetching(false);
    }
  };

  if (loading || (fetching && !orders.length)) {
    return (
      <div className="account-page-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
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

      {error && <div className="auth-error-banner" style={{ marginBottom: '24px' }}>{error}</div>}

      {orders.length === 0 ? (
        <div className="account-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-grey-dark)" strokeWidth="1.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginTop: '16px', textTransform: 'uppercase' }}>No orders found</h3>
          <p style={{ color: 'var(--color-grey-dark)', marginTop: '8px', fontSize: '0.875rem' }}>
            You haven't placed any orders yet. Explore our latest collections.
          </p>
          <Link href="/collections/vahn-beginning" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-block' }}>
            Shop Collections
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              {/* Order Card Header */}
              <div className="order-card-header">
                <div>
                  <span className="order-number">{order.id}</span>
                  <span className="order-date">Placed on {order.createdAt}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span className={`order-status-badge status-${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                  <strong className="order-total-price">
                    {formatMoney(order.totalPrice)}
                  </strong>
                </div>
              </div>

              {/* Order Items */}
              <div className="order-items-list">
                {order.items.map((item) => (
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
                      <div className="order-item-thumbnail" style={{ background: 'var(--color-grey-light)' }} />
                    )}
                    <div className="order-item-meta">
                      <h4 className="order-item-title">{item.productTitle}</h4>
                      {item.variantTitle && item.variantTitle !== 'Default Title' && (
                        <p className="order-item-variant">{item.variantTitle}</p>
                      )}
                      <p className="order-item-qty">Qty: {item.quantity}</p>
                    </div>
                    <div className="order-item-price">
                      {formatMoney(item.price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
