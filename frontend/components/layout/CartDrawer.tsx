'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api/client';

export default function CartDrawer() {
  const { cart, isOpen, isLoading, closeCart, lines, totalQuantity, updateItem, removeItem, clearCart } = useCart();
  const { user, openAuthModal, getAuthHeaders } = useAuth();
  const router = useRouter();

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  const handleCheckout = () => {
    if (!cart?.id) return;
    closeCart();

    if (!user) {
      openAuthModal('login', () => {
        router.push('/checkout');
      });
      return;
    }

    router.push('/checkout');
  };

  return (
    <>
      <div className={`backdrop ${isClosing ? 'closing' : ''}`} onClick={closeCart} />
      <div className={`cart-drawer ${isClosing ? 'closing' : ''}`} role="dialog" aria-label="Shopping cart" aria-modal="true">
        {/* Header */}
        <div className="cart-drawer-header">
          <h2>Cart {totalQuantity > 0 && `(${totalQuantity})`}</h2>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--color-black)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="2" x2="18" y2="18" /><line x1="18" y1="2" x2="2" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="cart-drawer-body">
          {checkoutError && (
            <div style={{ margin: '12px', padding: '12px', background: 'rgba(229, 57, 53, 0.08)', border: '1px solid rgba(229, 57, 53, 0.25)', borderRadius: '0px' }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#c62828', margin: '0 0 8px' }}>
                {checkoutError}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: '0.75rem', padding: '6px', background: '#ffffff', borderColor: '#c62828', color: '#c62828', fontWeight: 700 }}
                onClick={() => {
                  lines.forEach(l => {
                    if (l.merchandise.quantityAvailable === 0 || checkoutError.toLowerCase().includes('stock')) {
                      removeItem(l.id);
                    }
                  });
                  setCheckoutError('');
                }}
              >
                Clear Out of Stock Items ✕
              </button>
            </div>
          )}

          {lines.length === 0 ? (
            <div className="cart-empty">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--color-grey-mid)" strokeWidth="2">
                <path d="M6 6h5l6.42 22.53A3 3 0 0 0 20.24 31h19.14a3 3 0 0 0 2.82-2.01L46 14H14" />
                <circle cx="20" cy="40" r="2.5" />
                <circle cx="37" cy="40" r="2.5" />
              </svg>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>Your cart is empty</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)' }}>
                  Add items to get started.
                </p>
              </div>
              <Link href="/collections/vahn-beginning" className="btn btn-primary" onClick={closeCart}>
                Shop Collection
              </Link>
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.id} className="cart-line-item">
                {/* Image */}
                {line.merchandise.product.featuredImage ? (
                  <Image
                    src={line.merchandise.product.featuredImage.url}
                    alt={line.merchandise.product.featuredImage.altText ?? line.merchandise.product.title}
                    width={80}
                    height={80}
                    className="cart-item-image"
                  />
                ) : (
                  <div className="cart-item-image" style={{ background: 'var(--color-grey-light)' }} />
                )}

                {/* Details */}
                <div className="cart-item-details">
                  <Link
                    href={`/products/${line.merchandise.product.handle}`}
                    className="cart-item-title"
                    onClick={closeCart}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {line.merchandise.product.title}
                  </Link>
                  {line.merchandise.title !== 'Default Title' && (
                    <span className="cart-item-variant">{line.merchandise.title}</span>
                  )}
                  <span className="cart-item-price">{formatMoney(line.merchandise.price)}</span>

                  {/* Quantity selector */}
                  <div className="qty-selector" style={{ marginTop: '8px' }}>
                    <button
                      className="qty-btn"
                      aria-label="Decrease quantity"
                      onClick={() => updateItem(line.id, line.quantity - 1)}
                      disabled={isLoading}
                    >
                      −
                    </button>
                    <span className="qty-input">{line.quantity}</span>
                    <button
                      className={`qty-btn ${line.merchandise.quantityAvailable !== undefined && line.quantity >= line.merchandise.quantityAvailable ? 'disabled' : ''}`}
                      aria-label="Increase quantity"
                      onClick={() => {
                        if (line.merchandise.quantityAvailable !== undefined && line.quantity >= line.merchandise.quantityAvailable) {
                          return;
                        }
                        updateItem(line.id, line.quantity + 1);
                      }}
                      disabled={isLoading || (line.merchandise.quantityAvailable !== undefined && line.quantity >= line.merchandise.quantityAvailable)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Remove */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {formatMoney(line.cost.totalAmount)}
                  </span>
                  <button
                    onClick={() => removeItem(line.id)}
                    aria-label="Remove item"
                    disabled={isLoading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-grey-dark)', fontSize: '0.75rem', textDecoration: 'underline' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && cart && (
          <div className="cart-drawer-footer">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <span>{formatMoney(cart.cost.subtotalAmount)}</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-grey-dark)' }}>
              Shipping and taxes calculated at checkout
            </p>
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || isLoading}
              className="btn btn-primary btn-full"
            >
              {checkoutLoading ? (
                <span>Creating Order...</span>
              ) : (
                'Checkout →'
              )}
            </button>
            <button
              onClick={closeCart}
              className="btn btn-secondary btn-full"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
