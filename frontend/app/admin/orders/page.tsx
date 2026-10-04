'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getAdminOrders, type AdminOrderSummary, type PaginatedResponse } from '@/lib/api/admin';
import AdminBadge from '@/components/admin/AdminBadge';
import Link from 'next/link';
import { clientCache } from '@/lib/api/cache';
import { getPublicTrackingUrl } from '@/lib/utils';
import { formatISTDateTime } from '@/lib/utils/date';

const STATUS_FILTERS = [
  { label: 'All Orders', status: '', returnStatus: '' },
  { label: 'Processing', status: 'PROCESSING', returnStatus: '' },
  { label: 'Shipped', status: 'SHIPPED', returnStatus: '' },
  { label: 'Delivered', status: 'DELIVERED', returnStatus: '' },
  { label: 'Returns & Exchanges', status: '', returnStatus: 'ACTIVE' },
  { label: 'Cancelled / Refunded', status: 'CANCELLED', returnStatus: '' },
];

export function getOrderUnifiedStatus(order: AdminOrderSummary): {
  label: string;
  subtext?: string;
  variant: string;
} {
  // 1. Payment Failed
  if (order.payment_status === 'FAILED' || order.status === 'FAILED') {
    return { label: 'PAYMENT FAILED', variant: 'FAILED' };
  }
  // 2. Order Cancelled
  if (order.status === 'CANCELLED') {
    return { label: 'CANCELLED', variant: 'CANCELLED' };
  }

  // 3. Active Return / Exchange Lifecycle
  const isReturnActive =
    order.return_status && !['NONE', 'CANCELLED'].includes(order.return_status);
  const isReplacement = order.return_type === 'REPLACEMENT';

  if (isReturnActive) {
    if (order.replacement_status === 'REPLACEMENT_DISPATCHED') {
      return {
        label: 'EXCHANGE DISPATCHED',
        subtext: order.replacement_variant_title
          ? `Size: ${order.replacement_variant_title}`
          : undefined,
        variant: 'SHIPPED',
      };
    }
    if (order.return_status === 'PICKED_UP' || order.replacement_status === 'PICKED_UP') {
      return {
        label: isReplacement ? 'ORIGINAL PICKED UP' : 'ITEM PICKED UP',
        subtext: isReplacement
          ? order.replacement_variant_title
            ? `Size: ${order.replacement_variant_title}`
            : 'Ready to dispatch'
          : 'Refund processing',
        variant: 'PROCESSING',
      };
    }
    if (order.return_status === 'REFUNDED' || order.refund_status === 'REFUNDED') {
      return { label: 'REFUNDED', variant: 'REFUNDED' };
    }
    return {
      label: isReplacement ? 'EXCHANGE REQUESTED' : 'RETURN REQUESTED',
      subtext:
        isReplacement && order.replacement_variant_title
          ? `Size: ${order.replacement_variant_title}`
          : undefined,
      variant: 'PROCESSING',
    };
  }

  // 4. Return was Cancelled (Customer kept original item)
  if (order.return_status === 'CANCELLED') {
    return {
      label: 'DELIVERED',
      subtext: isReplacement ? 'Exchange Cancelled' : 'Return Cancelled',
      variant: 'DELIVERED',
    };
  }

  // 5. Forward Shipping / Delivery
  if (order.status === 'DELIVERED' || order.shipping_status === 'DELIVERED') {
    return { label: 'DELIVERED', variant: 'DELIVERED' };
  }
  if (order.shipping_status === 'OUT_FOR_DELIVERY') {
    return { label: 'OUT FOR DELIVERY', variant: 'SHIPPED' };
  }
  if (
    order.status === 'SHIPPED' ||
    order.shipping_status === 'IN_TRANSIT' ||
    order.shipping_status === 'SHIPPED'
  ) {
    return { label: 'IN TRANSIT', variant: 'SHIPPED' };
  }

  return { label: order.status || 'PROCESSING', variant: order.status || 'PROCESSING' };
}

export default function AdminOrdersPage() {
  const { adminToken } = useAdminAuth();
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const activeFilter = STATUS_FILTERS[activeTabIdx];
  const status = activeFilter.status;
  const returnStatus = activeFilter.returnStatus;

  const cachePath = `/admin/orders?page=${page}${status ? `&status=${status}` : ''}${returnStatus ? `&return_status=${returnStatus}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const cacheKey = adminToken ? `admin:${adminToken.slice(0, 10)}:${cachePath}` : '';
  const initialData = cacheKey
    ? clientCache.get<PaginatedResponse<AdminOrderSummary>>(cacheKey)
    : null;

  const [data, setData] = useState<PaginatedResponse<AdminOrderSummary> | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  async function load(isSilent = false) {
    if (!adminToken) return;
    if (!isSilent && !data) setLoading(true);
    try {
      const res = await getAdminOrders(adminToken, {
        page,
        status: status || undefined,
        return_status: returnStatus || undefined,
        search: search || undefined,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(!!initialData);
  }, [adminToken, page, activeTabIdx, search]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Orders Management</h1>
          <p className="admin-page-subtitle">{data?.total || 0} total registered & guest orders</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="admin-filters-row">
        <div
          className="admin-status-tabs"
          style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
        >
          {STATUS_FILTERS.map((tab, idx) => (
            <button
              key={tab.label}
              className={`admin-status-tab ${activeTabIdx === idx ? 'admin-status-tab--active' : ''}`}
              onClick={() => {
                setActiveTabIdx(idx);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          className="admin-search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
        >
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search Order ID, Email, Name, AWB..."
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              if (!val.trim()) {
                setSearch('');
                setPage(1);
              }
            }}
          />
          <button type="submit" className="admin-btn admin-btn--secondary">
            Search
          </button>
          {search && (
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-row">
            <div className="admin-loading-spinner" />
            <span>Loading orders...</span>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Total & Payment</th>
                  <th>Status</th>
                  <th>Logistics & Tracking</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!data?.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">
                      No orders found matching this filter.
                    </td>
                  </tr>
                )}
                {data?.items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Link href={`/admin/orders/${order.id}`} className="admin-table-link">
                          {order.id}
                        </Link>
                        {order.is_guest && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              background: '#f0f0f0',
                              color: '#555',
                              padding: '2px 5px',
                              borderRadius: '0px',
                              textTransform: 'uppercase',
                            }}
                          >
                            GUEST
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-name">{order.user_name || 'Guest Customer'}</div>
                      <div className="admin-table-sub">{order.user_email || 'No email'}</div>
                      {order.user_phone && (
                        <div style={{ fontSize: '0.72rem', color: '#888' }}>
                          Ph: {order.user_phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                        ₹{order.total_amount.toLocaleString('en-IN')}
                      </div>
                      {order.payment_status === 'FAILED' ? (
                        <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 800 }}>
                          {order.payment_method?.toUpperCase().includes('RAZORPAY')
                            ? 'RAZORPAY'
                            : order.payment_method || 'RAZORPAY'}{' '}
                          (FAILED)
                        </div>
                      ) : order.payment_status === 'REFUNDED' ||
                        order.refund_status === 'REFUNDED' ? (
                        <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 800 }}>
                          {order.payment_method?.toUpperCase().includes('RAZORPAY')
                            ? 'RAZORPAY'
                            : order.payment_method || 'PREPAID'}{' '}
                          (REFUNDED)
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>
                          {order.payment_method?.toUpperCase().includes('RAZORPAY')
                            ? 'RAZORPAY'
                            : order.payment_method || 'PREPAID'}{' '}
                          (PAID)
                        </div>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const st = getOrderUnifiedStatus(order);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <AdminBadge label={st.label} variant={st.variant} />
                            {st.subtext && (
                              <span
                                style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 700 }}
                              >
                                {st.subtext}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      {order.shiprocket_awb ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <a
                            href={getPublicTrackingUrl(order.shiprocket_awb)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.75rem',
                              color: '#4232d9',
                              textDecoration: 'underline',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                            }}
                          >
                            AWB: {order.shiprocket_awb}
                          </a>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#999' }}>
                          Awaiting Dispatch
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#666' }}>{formatISTDateTime(order.created_at)}</td>
                    <td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        style={{
                          background: '#000',
                          color: '#fff',
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          textTransform: 'uppercase',
                          borderRadius: '0px',
                          display: 'inline-block',
                        }}
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="admin-pagination">
            <button
              className="admin-btn admin-btn--ghost"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span className="admin-pagination-info">
              Page {page} of {data.total_pages}
            </span>
            <button
              className="admin-btn admin-btn--ghost"
              disabled={page === data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
