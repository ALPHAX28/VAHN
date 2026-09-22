'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';

function formatCartPrice(amountStr: string | number | undefined | null): string {
  if (amountStr === undefined || amountStr === null) return '₹ 0';
  const num = typeof amountStr === 'string' ? parseFloat(amountStr) : amountStr;
  if (Number.isNaN(num)) return '₹ 0';
  const hasDecimals = num % 1 !== 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export default function CartDrawer() {
  const { cart, isOpen, isLoading, closeCart, lines, totalQuantity, updateItem, removeItem } =
    useCart();
  const router = useRouter();

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (shouldRender) {
      setIsClosing(true);
      document.body.style.overflow = '';
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  const handleCheckout = () => {
    if (!cart?.id) return;
    setCheckoutLoading(true);
    closeCart();
    router.push('/checkout');
  };

  const getVariantTags = (line: (typeof lines)[0]): string[] => {
    const tags: string[] = [];
    if (line.merchandise.selectedOptions && line.merchandise.selectedOptions.length > 0) {
      for (const opt of line.merchandise.selectedOptions) {
        if (opt.value && opt.value.toLowerCase() !== 'default title') {
          tags.push(opt.value);
        }
      }
    }
    if (
      tags.length === 0 &&
      line.merchandise.title &&
      line.merchandise.title.toLowerCase() !== 'default title'
    ) {
      const parts = line.merchandise.title
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean);
      tags.push(...parts);
    }
    return tags;
  };

  return (
    <>
      <button
        type="button"
        className={`backdrop ${isClosing ? 'closing' : ''}`}
        onClick={closeCart}
        aria-label="Close cart backdrop"
      />
      <div
        className={`cart-drawer ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
      >
        {/* Header */}
        <div className="cart-drawer-header">
          <h2>
            YOUR CART
            {totalQuantity > 0 && <sup>{totalQuantity}</sup>}
          </h2>
          <button onClick={closeCart} aria-label="Close cart" className="cart-close-btn">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="cart-drawer-body">
          {checkoutError && (
            <div
              style={{
                margin: '8px 10px',
                padding: '12px',
                background: 'rgba(229, 57, 53, 0.08)',
                border: '1px solid rgba(229, 57, 53, 0.25)',
              }}
            >
              <p
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#c62828',
                  margin: '0 0 8px',
                }}
              >
                {checkoutError}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.75rem',
                  padding: '6px',
                  background: '#ffffff',
                  borderColor: '#c62828',
                  color: '#c62828',
                  fontWeight: 700,
                }}
                onClick={() => {
                  lines.forEach((l) => {
                    if (
                      l.merchandise.quantityAvailable === 0 ||
                      checkoutError.toLowerCase().includes('stock')
                    ) {
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
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-grey-mid)"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M6 6h5l6.42 22.53A3 3 0 0 0 20.24 31h19.14a3 3 0 0 0 2.82-2.01L46 14H14" />
                <circle cx="20" cy="40" r="2.5" />
                <circle cx="37" cy="40" r="2.5" />
              </svg>
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    letterSpacing: '-0.01em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    color: '#000000',
                  }}
                >
                  Your cart is empty
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-ui), sans-serif',
                    fontSize: '0.85rem',
                    color: 'var(--color-grey-dark)',
                    margin: 0,
                  }}
                >
                  Add items to get started.
                </p>
              </div>
              <Link
                href="/products"
                className="btn btn-primary"
                onClick={closeCart}
                style={{
                  borderRadius: 0,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                Explore Products
              </Link>
            </div>
          ) : (
            lines.map((line) => {
              const imgObj = line.merchandise.image || line.merchandise.product.featuredImage;
              const imageUrl = imgObj?.url;
              const imageAlt = imgObj?.altText || line.merchandise.product.title;
              const variantTags = getVariantTags(line);

              return (
                <div key={line.id} className="cart-item-card">
                  {/* Image */}
                  <Link
                    href={`/products/${line.merchandise.product.handle}`}
                    onClick={closeCart}
                    className="cart-item-image-wrapper"
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={imageAlt}
                        width={96}
                        height={116}
                        className="cart-item-img"
                      />
                    ) : (
                      <div className="cart-item-img-placeholder" />
                    )}
                  </Link>

                  {/* Details */}
                  <div className="cart-item-info">
                    {/* Top Row: Title & Price */}
                    <div className="cart-item-top-row">
                      <Link
                        href={`/products/${line.merchandise.product.handle}`}
                        className="cart-item-title"
                        onClick={closeCart}
                      >
                        {line.merchandise.product.title}
                      </Link>
                      <span className="cart-item-price">
                        {formatCartPrice(line.merchandise.price.amount)}
                      </span>
                    </div>

                    {/* Middle Row: Variant Badges & Remove */}
                    <div className="cart-item-mid-row">
                      <div className="cart-variant-badges">
                        {variantTags.map((tag) => (
                          <span key={`${line.id}-${tag}`} className="cart-variant-badge">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(line.id)}
                        aria-label="Remove item"
                        disabled={isLoading}
                        className="cart-item-remove-btn"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Bottom Row: Quantity Selector */}
                    <div className="cart-item-bottom-row">
                      <div className="cart-qty-control">
                        <button
                          type="button"
                          className="cart-qty-btn cart-qty-dec"
                          aria-label="Decrease quantity"
                          onClick={() => updateItem(line.id, line.quantity - 1)}
                          disabled={isLoading}
                        >
                          -
                        </button>
                        <span className="cart-qty-val">{line.quantity}</span>
                        <button
                          type="button"
                          className={`cart-qty-btn cart-qty-inc ${line.merchandise.quantityAvailable !== undefined && line.quantity >= line.merchandise.quantityAvailable ? 'disabled' : ''}`}
                          aria-label="Increase quantity"
                          onClick={() => {
                            if (
                              line.merchandise.quantityAvailable !== undefined &&
                              line.quantity >= line.merchandise.quantityAvailable
                            ) {
                              return;
                            }
                            updateItem(line.id, line.quantity + 1);
                          }}
                          disabled={
                            isLoading ||
                            (line.merchandise.quantityAvailable !== undefined &&
                              line.quantity >= line.merchandise.quantityAvailable)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && cart && (
          <div className="cart-drawer-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">ESTIMATED TOTAL</span>
              <span className="cart-total-amount">
                {formatCartPrice(cart.cost.totalAmount.amount)}
              </span>
            </div>
            <p className="cart-shipping-notice">Shipping and taxes calculated at checkout</p>
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || isLoading}
              className="cart-checkout-btn"
            >
              {checkoutLoading ? 'PROCESSING...' : 'PROCEED TO CHECKOUT'}
            </button>
            <button
              type="button"
              onClick={closeCart}
              className="cart-continue-btn"
              style={{ marginTop: '8px', fontSize: '0.75rem' }}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
