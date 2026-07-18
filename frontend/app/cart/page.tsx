'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { formatMoney } from '@/lib/utils';

export default function CartPage() {
  const { cart, lines, totalQuantity, isLoading, updateItem, removeItem } = useCart();

  if (totalQuantity === 0) {
    return (
      <div className="not-found" style={{ minHeight: '60vh' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>Your Cart</h1>
          <p style={{ color: 'var(--color-grey-dark)', fontFamily: 'var(--font-body)', marginTop: '12px', marginBottom: '32px' }}>
            Your cart is empty.
          </p>
          <Link href="/collections/vahn-beginning" className="btn btn-primary">
            Shop the Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      {/* Left: Items */}
      <div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', marginBottom: '32px' }}>
          Your Cart ({totalQuantity})
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {lines.map((line) => (
            <div
              key={line.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr',
                gap: '20px',
                paddingBottom: '24px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {/* Image */}
              <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--color-grey-light)' }}>
                {line.merchandise.product.featuredImage && (
                  <Image
                    src={line.merchandise.product.featuredImage.url}
                    alt={line.merchandise.product.featuredImage.altText ?? line.merchandise.product.title}
                    fill
                    sizes="100px"
                    style={{ objectFit: 'cover' }}
                  />
                )}
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  <Link
                    href={`/products/${line.merchandise.product.handle}`}
                    style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'inherit', textDecoration: 'none' }}
                  >
                    {line.merchandise.product.title}
                  </Link>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatMoney(line.cost.totalAmount)}
                  </span>
                </div>

                {line.merchandise.title !== 'Default Title' && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)' }}>
                    {line.merchandise.title}
                  </p>
                )}

                <p style={{ fontSize: '0.875rem', color: 'var(--color-grey-dark)' }}>
                  {formatMoney(line.merchandise.price)} each
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
                  <div className="qty-selector">
                    <button
                      className="qty-btn"
                      onClick={() => updateItem(line.id, line.quantity - 1)}
                      disabled={isLoading}
                      aria-label="Decrease"
                    >−</button>
                    <span className="qty-input">{line.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateItem(line.id, line.quantity + 1)}
                      disabled={isLoading}
                      aria-label="Increase"
                    >+</button>
                  </div>
                  <button
                    onClick={() => removeItem(line.id)}
                    disabled={isLoading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-grey-dark)', textDecoration: 'underline' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Order Summary */}
      {cart && (
        <div>
          <div
            style={{
              border: '1px solid var(--color-border)',
              padding: '24px',
              position: 'sticky',
              top: 'calc(var(--header-height) + 16px)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '24px' }}>
              Order Summary
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
                <span>Subtotal</span>
                <span>{formatMoney(cart.cost.subtotalAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: 'var(--color-grey-dark)' }}>
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              {cart.cost.totalTaxAmount && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: 'var(--color-grey-dark)' }}>
                  <span>Tax</span>
                  <span>{formatMoney(cart.cost.totalTaxAmount)}</span>
                </div>
              )}
              <div style={{ height: '1px', background: 'var(--color-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.125rem' }}>
                <span>Total</span>
                <span>{formatMoney(cart.cost.totalAmount)}</span>
              </div>
            </div>

            <a href={cart.checkoutUrl} className="btn btn-primary btn-full" rel="noopener noreferrer">
              Proceed to Checkout →
            </a>

            <Link href="/collections/vahn-beginning" className="btn btn-secondary btn-full" style={{ marginTop: '12px' }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
