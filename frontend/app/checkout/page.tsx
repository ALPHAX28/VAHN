'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import AddressModal from '@/components/address/AddressModal';
import {
  AlertCircleIcon,
  BriefcaseIcon,
  CheckIcon,
  EditIcon,
  HomeIcon,
  LockIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserIcon,
} from '@/components/icons/Icons';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import {
  checkShippingServiceability,
  createMagicCheckoutOrder,
  createRazorpayOrder,
  getUserAddresses,
  recordRazorpayPaymentFailure,
  verifyRazorpayPayment,
} from '@/lib/api';
import type { ServiceabilityResponse, UserAddress } from '@/lib/api/types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const { user, token, openAuthModal, loading: isAuthLoading } = useAuth();
  const { cart, clearCart } = useCart();
  const router = useRouter();

  // Logged-in address state
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  // Guest checkout state
  const [guestPincodeInput, setGuestPincodeInput] = useState('');

  // Serviceability check state
  const [serviceability, setServiceability] = useState<ServiceabilityResponse | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  // Process & Error states
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState('');
  const [rzpLoaded, setRzpLoaded] = useState(false);

  // Ensure clean, valid Razorpay SDK instance and detect detached iframes
  const ensureFreshRazorpaySdk = useCallback(async (isGuestUser: boolean): Promise<any> => {
    if (typeof window === 'undefined') return null;

    const targetScriptSrc = isGuestUser
      ? 'https://checkout.razorpay.com/v1/magic-checkout.js'
      : 'https://checkout.razorpay.com/v1/checkout.js';

    // Check if an existing iframe was detached or corrupted (contentWindow is null)
    const existingIframe = document.querySelector(
      '.razorpay-container iframe'
    ) as HTMLIFrameElement | null;
    const hasCorruptedIframe = existingIframe && !existingIframe.contentWindow;

    const allScripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>("script[src*='checkout.razorpay.com']")
    );
    const currentScript = allScripts.find((s) => s.src === targetScriptSrc);

    if (currentScript && (window as any).Razorpay && !hasCorruptedIframe) {
      setRzpLoaded(true);
      return (window as any).Razorpay;
    }

    // Cleanly purge corrupted scripts and detached containers
    allScripts.forEach((s) => {
      s.remove();
    });
    document.querySelectorAll('.razorpay-container').forEach((el) => {
      el.remove();
    });
    try {
      delete (window as any).Razorpay;
    } catch {
      (window as any).Razorpay = undefined;
    }

    setRzpLoaded(false);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = 'rzp-checkout-script';
      script.src = targetScriptSrc;
      script.async = true;
      script.onload = () => {
        setRzpLoaded(true);
        resolve((window as any).Razorpay);
      };
      script.onerror = () => {
        console.warn('Primary SDK load failed, falling back to standard checkout.js');
        const fallbackScript = document.createElement('script');
        fallbackScript.id = 'rzp-checkout-script';
        fallbackScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
        fallbackScript.async = true;
        fallbackScript.onload = () => {
          setRzpLoaded(true);
          resolve((window as any).Razorpay);
        };
        document.body.appendChild(fallbackScript);
      };
      document.body.appendChild(script);
    });
  }, []);

  // Initial load
  useEffect(() => {
    if (typeof window === 'undefined' || isAuthLoading) return;
    ensureFreshRazorpaySdk(!user);
  }, [user, isAuthLoading, ensureFreshRazorpaySdk]);

  // Live Pincode Serviceability Check
  const handleCheckPincode = useCallback(async (pin: string) => {
    const cleanPin = pin.trim();
    if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
      setServiceability(null);
      return;
    }
    if (!/^[1-9]\d{5}$/.test(cleanPin)) {
      setServiceability({
        pincode: cleanPin,
        serviceable: false,
        message:
          'Invalid PIN code format. Indian PIN codes must be 6 digits and cannot start with 0.',
      });
      return;
    }
    setCheckingPincode(true);
    try {
      const res = await checkShippingServiceability(cleanPin);
      setServiceability(res);
    } catch {
      setServiceability({
        pincode: cleanPin,
        serviceable: false,
        message: 'Unable to verify courier coverage for this PIN code.',
      });
    } finally {
      setCheckingPincode(false);
    }
  }, []);

  const loadAddresses = useCallback(async () => {
    if (!token) return;
    setLoadingAddresses(true);
    try {
      const data = await getUserAddresses(token);
      setAddresses(data);
      if (data.length > 0) {
        const defaultAddr = data.find((a) => a.is_default) || data[0];
        setSelectedAddressId(defaultAddr.id);
        handleCheckPincode(defaultAddr.pincode);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingAddresses(false);
    }
  }, [token, handleCheckPincode]);

  // Load addresses if logged in
  useEffect(() => {
    if (token) {
      loadAddresses();
    }
  }, [token, loadAddresses]);

  // Calculate pricing
  const cartLines = cart?.lines.edges.map((e) => e.node) || [];
  const totalQuantity = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce(
    (sum, line) => sum + parseFloat(line.merchandise.price.amount) * line.quantity,
    0
  );
  const customShippingRate = cartLines.reduce((max, line) => {
    const rate = line.merchandise.product.shippingRate;
    return rate != null && rate <= 500 ? Math.max(max, rate) : max;
  }, -1);
  const shippingFee =
    subtotal >= 1999 || subtotal === 0 ? 0 : customShippingRate >= 0 ? customShippingRate : 99;

  const estimatedTax = Math.round(
    cartLines.reduce((taxSum, line) => {
      const price = parseFloat(line.merchandise.price.amount);
      const lineTotal = price * line.quantity;
      const gstPct = line.merchandise.product.gstPercent ?? 12;
      return taxSum + lineTotal * (gstPct / (100 + gstPct));
    }, 0)
  );

  const grandTotal = subtotal + shippingFee;
  const selectedAddr = addresses.find((a) => a.id === selectedAddressId);

  const cleanUpRazorpayModal = (instance?: any) => {
    try {
      if (instance && typeof instance.close === 'function') {
        instance.close();
      }
    } catch {}
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
      document.documentElement.style.overflow = 'auto';
      const elements = document.querySelectorAll(".razorpay-container, iframe[name^='razorpay']");
      elements.forEach((el) => {
        try {
          el.remove();
        } catch {}
      });
      if (elements.length > 0 && typeof window !== 'undefined') {
        try {
          delete (window as any).Razorpay;
          (window as any).Razorpay = undefined;
        } catch {}
      }
    }
  };

  // Trigger Razorpay Checkout
  async function handleInitiatePayment() {
    if (placingOrder) return;
    setError('');

    if (!cart?.id || cartLines.length === 0) {
      setError('Your cart is empty. Please add items before checking out.');
      return;
    }

    // Validation
    let shippingPayload: any = null;
    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';

    if (user && token) {
      if (!selectedAddressId || !selectedAddr) {
        setError('Please select a delivery address.');
        return;
      }
      customerName =
        `${selectedAddr.first_name} ${selectedAddr.last_name}`.trim() || user.full_name;
      customerEmail = selectedAddr.email || user.email || '';
      customerPhone = selectedAddr.phone || user.phone || '';
      shippingPayload = {
        name: customerName,
        phone: customerPhone,
        address: `${selectedAddr.house_flat_no || ''} ${selectedAddr.street_address}`.trim(),
        apartment: selectedAddr.apartment || selectedAddr.building_name || '',
        city: selectedAddr.city,
        state: selectedAddr.state,
        pincode: selectedAddr.pincode,
        country: selectedAddr.country || 'India',
      };
    } else {
      // Guest: Razorpay Magic Checkout collects all contact & address details.
      // Backend fetches name, email, phone, and shipping address from the Razorpay
      // order/payment after the user completes payment — no local form needed.
      customerName = '';
      customerEmail = '';
      customerPhone = '';
      shippingPayload = null;
    }

    setPlacingOrder(true);

    try {
      // 1. Create Razorpay order on backend
      const rzpOrder = await createRazorpayOrder(
        {
          cart_id: cart.id,
          address_id: selectedAddressId || undefined,
          shipping_address: shippingPayload,
        },
        token || undefined
      );

      const isGuest = !user;

      // Ensure fresh, uncorrupted Razorpay SDK before creating order
      const RazorpayConstructor = await ensureFreshRazorpaySdk(isGuest);
      if (!RazorpayConstructor && typeof (window as any).Razorpay === 'undefined') {
        throw new Error('Razorpay gateway is initializing. Please try again in a few moments.');
      }
      const RzpClass = RazorpayConstructor || (window as any).Razorpay;

      // 2. Open Razorpay modal
      const options: any = {
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency || 'INR',
        name: 'VAHN Sports',
        description: `Order Payment (${cartLines.length} item${cartLines.length > 1 ? 's' : ''})`,
        image: 'https://vahn.s3.ap-south-2.amazonaws.com/logo.png',
        order_id: rzpOrder.razorpay_order_id,
        one_click_checkout: isGuest, // True for guest (Razorpay Magic Checkout Gateway), False for logged-in athletes
        show_coupons: isGuest,
        handler: async (response: any) => {
          try {
            let confirmedId = '';
            if (user && token) {
              const verifiedOrder = await verifyRazorpayPayment(
                {
                  cart_id: cart.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  address_id: selectedAddressId || undefined,
                  shipping_address: shippingPayload,
                },
                token
              );
              confirmedId =
                (verifiedOrder as any)?.id ||
                (verifiedOrder as any)?.order_id ||
                (verifiedOrder as any)?.orderId ||
                '';
            } else {
              // Guest checkout verification
              const guestOrder = await createMagicCheckoutOrder({
                cart_id: cart.id,
                guest_name: customerName,
                guest_email: customerEmail,
                guest_phone: customerPhone,
                shipping_address: shippingPayload,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              confirmedId =
                (guestOrder as any)?.id ||
                (guestOrder as any)?.order_id ||
                (guestOrder as any)?.orderId ||
                '';
            }
            clearCart();
            if (confirmedId) {
              router.push(`/checkout/success?order_id=${confirmedId}`);
            } else {
              router.push('/account/orders');
            }
          } catch (verifyErr: any) {
            cleanUpRazorpayModal(rzpInstance);
            const verifyMsg =
              verifyErr?.message || 'Payment verification failed. Please contact VAHN support.';
            try {
              if (typeof recordRazorpayPaymentFailure === 'function') {
                const failedOrder = await recordRazorpayPaymentFailure(
                  {
                    cart_id: cart.id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    error_description: verifyMsg,
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_phone: customerPhone,
                    shipping_address: shippingPayload,
                  },
                  token || undefined
                );
                const failedOrderId =
                  (failedOrder as any)?.id || (failedOrder as any)?.order_id || '';
                router.push(
                  `/checkout/failed?order_id=${failedOrderId}&reason=${encodeURIComponent(verifyMsg)}`
                );
                return;
              }
            } catch {
              // Fallback to simple query string
            }
            router.push(`/checkout/failed?reason=${encodeURIComponent(verifyMsg)}`);
          } finally {
            setPlacingOrder(false);
          }
        },
        prefill: {
          name: customerName || undefined,
          email: customerEmail || undefined,
          contact: customerPhone || undefined,
        },
        notes: {
          cart_id: cart.id,
          is_guest: isGuest ? 'true' : 'false',
          customer_name: customerName || 'Guest Athlete',
          customer_email: customerEmail || '',
          customer_phone: customerPhone || '',
          delivery_address: shippingPayload
            ? `${shippingPayload.address}, ${shippingPayload.city}, ${shippingPayload.state} - ${shippingPayload.pincode}`
            : 'Collected via Razorpay Magic Checkout',
          store: 'VAHN Sports Official',
        },
        theme: {
          color: '#4232d9',
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setPlacingOrder(false);
            if (typeof document !== 'undefined') {
              document.body.style.overflow = 'auto';
              document.documentElement.style.overflow = 'auto';
              // Never forcefully delete .razorpay-container: Razorpay automatically hides the modal.
              // Deleting the DOM container detaches the iframe and breaks contentWindow on retry.
            }
            setError(
              'Payment was cancelled or closed. You can retry anytime — your cart items are preserved.'
            );
          },
        },
      };

      const rzpInstance = new RzpClass(options);
      rzpInstance.on('payment.failed', async (response: any) => {
        cleanUpRazorpayModal(rzpInstance);

        const errorDesc =
          response?.error?.description ||
          response?.error?.reason ||
          'Transaction declined by bank.';
        const errorCode = response?.error?.code || '';
        const rzpOrderId = response?.error?.metadata?.order_id || rzpOrder.razorpay_order_id;
        const rzpPaymentId = response?.error?.metadata?.payment_id || '';

        try {
          if (typeof recordRazorpayPaymentFailure === 'function') {
            const failedOrder = await recordRazorpayPaymentFailure(
              {
                cart_id: cart.id,
                razorpay_order_id: rzpOrderId,
                razorpay_payment_id: rzpPaymentId,
                error_code: errorCode,
                error_description: errorDesc,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                shipping_address: shippingPayload,
              },
              token || undefined
            );
            const failedOrderId = (failedOrder as any)?.id || (failedOrder as any)?.order_id || '';
            router.push(
              `/checkout/failed?order_id=${failedOrderId}&reason=${encodeURIComponent(errorDesc)}`
            );
            return;
          }
        } catch (recErr) {
          console.error('Could not record failure order:', recErr);
        }
        router.push(`/checkout/failed?reason=${encodeURIComponent(errorDesc)}`);
        setPlacingOrder(false);
      });
      try {
        rzpInstance.open();
      } catch (openErr: any) {
        console.error('Razorpay open error:', openErr);
        setPlacingOrder(false);
        setError('Unable to open payment gateway. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate payment. Please try again.');
      setPlacingOrder(false);
    }
  }

  if (!cartLines.length) {
    return (
      <div style={{ maxWidth: 560, margin: '100px auto', padding: '0 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            borderRadius: '0px',
          }}
        >
          <ShoppingBagIcon size={28} color="#fff" />
        </div>
        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            margin: '0 0 10px',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Your Cart is Empty
        </h2>
        <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 24px' }}>
          Add high-performance gear to your cart before proceeding to checkout.
        </p>
        <Link
          href="/products"
          style={{
            background: '#4232d9',
            color: '#fff',
            padding: '14px 32px',
            fontWeight: 800,
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '-0.025em',
            fontSize: '0.85rem',
            borderRadius: '0px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span>Explore Collection</span>
          <svg
            aria-hidden="true"
            className="btn-checkout-arrow"
            width="16"
            height="16"
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
    );
  }

  return (
    <div
      className="checkout-container"
      style={{
        maxWidth: 1040,
        margin: '30px auto 90px',
        padding: '0 20px',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px', marginTop: '10px' }}>
        <h1
          style={{
            fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.01em',
            margin: 0,
            color: '#000',
          }}
        >
          CHECKOUT
        </h1>
        <p style={{ color: '#666', fontSize: '0.825rem', margin: '6px 0 0' }}>
          UPI, cards and netbanking accepted. Secure and encrypted.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #ff4d4f',
            borderRadius: '0px',
            padding: '16px 20px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertCircleIcon size={20} color="#ff4d4f" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#cf1322', fontSize: '0.9rem' }}>
              Payment Alert
            </div>
            <div style={{ fontSize: '0.85rem', color: '#434343', marginTop: '2px' }}>{error}</div>
          </div>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 980px) {
          .checkout-main-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
        @media (max-width: 640px) {
          .checkout-container {
            margin: 20px auto 60px !important;
            padding: 0 14px !important;
          }
          .checkout-card {
            padding: 18px 14px !important;
          }
          .checkout-pincode-form {
            flex-direction: column !important;
            max-width: 100% !important;
          }
          .checkout-pincode-btn {
            width: 100% !important;
            padding: 12px !important;
          }
          .checkout-signin-strip {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 14px !important;
          }
          .checkout-summary-card {
            position: static !important;
            top: auto !important;
            padding: 18px 14px !important;
          }
          .checkout-pay-btn {
            padding: 16px 14px !important;
            font-size: 0.88rem !important;
          }
        }
      `}</style>

      {/* Main Grid: Responsive 2-column layout on desktop (1fr 440px), single-column on mobile */}
      <div
        className="checkout-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 440px)',
          gap: '32px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Logged-in Address Manager OR Revamped Guest Checkout Hub */}
        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 1. Delivery Details Section */}
            <div
              className="checkout-card"
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '0px',
                padding: '24px',
                background: '#fff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  borderBottom: '1px solid #f0f0f0',
                  paddingBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPinIcon size={20} color="#000" />
                  <h2
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '-0.02em',
                      margin: 0,
                    }}
                  >
                    Delivery Address
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAddress(null);
                    setShowAddressModal(true);
                  }}
                  style={{
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: '0px',
                  }}
                >
                  + Add New Address
                </button>
              </div>

              {/* Saved Address Selector */}
              {loadingAddresses ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading saved addresses...
                </div>
              ) : addresses.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
                    No saved addresses found. Add an address to proceed.
                  </p>
                  <button
                    onClick={() => {
                      setEditingAddress(null);
                      setShowAddressModal(true);
                    }}
                    style={{
                      background: '#4232d9',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 24px',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      borderRadius: '0px',
                    }}
                  >
                    Add Delivery Address
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      // biome-ignore lint/a11y/noStaticElementInteractions: address card selection
                      <div
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          handleCheckPincode(addr.pincode);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedAddressId(addr.id);
                            handleCheckPincode(addr.pincode);
                          }
                        }}
                        style={{
                          border: isSelected ? '2px solid #4232d9' : '1px solid #e0e0e0',
                          background: isSelected ? 'rgba(66, 50, 217, 0.03)' : '#fff',
                          borderRadius: '0px',
                          padding: '16px',
                          cursor: 'pointer',
                          transition: 'border 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="radio"
                              name="selected_address"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedAddressId(addr.id);
                                handleCheckPincode(addr.pincode);
                              }}
                              style={{ accentColor: '#4232d9', cursor: 'pointer' }}
                            />
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                textTransform: 'uppercase',
                              }}
                            >
                              {addr.first_name} {addr.last_name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: '#f0f0f0',
                                padding: '2px 6px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {addr.label || 'HOME'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAddress(addr);
                              setShowAddressModal(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#666',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textDecoration: 'underline',
                            }}
                          >
                            Edit
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: '#444',
                            lineHeight: 1.5,
                            marginLeft: '24px',
                          }}
                        >
                          {addr.house_flat_no ? `${addr.house_flat_no}, ` : ''}
                          {addr.street_address}
                          {addr.apartment ? `, ${addr.apartment}` : ''}
                          <br />
                          {addr.city}, {addr.state} - <strong>{addr.pincode}</strong>
                          <br />
                          <span style={{ color: '#777' }}>Phone: {addr.phone}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Logged-In Pincode Serviceability Indicator */}
              <div style={{ marginTop: '16px' }}>
                {checkingPincode ? (
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Verifying courier serviceability with Shiprocket...
                  </div>
                ) : serviceability ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      background: serviceability.serviceable ? '#f6ffed' : '#fff2f0',
                      border: `1px solid ${serviceability.serviceable ? '#b7eb8f' : '#ffccc7'}`,
                      fontSize: '0.8rem',
                      color: serviceability.serviceable ? '#389e0d' : '#cf1322',
                      fontWeight: 600,
                      borderRadius: '0px',
                    }}
                  >
                    {serviceability.serviceable ? (
                      <TruckIcon size={16} />
                    ) : (
                      <AlertCircleIcon size={16} color="#cf1322" />
                    )}
                    <span>
                      {serviceability.serviceable
                        ? `Delivery available${serviceability.city ? ` to ${serviceability.city}, ${serviceability.state}` : ''} via ${serviceability.courier_name || 'Express Courier'} (Est. ${serviceability.estimated_days || `${serviceability.estimated_delivery_days || 3} business days`})`
                        : serviceability.message ||
                          `Delivery is not serviceable to PIN ${serviceability.pincode}`}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          /* Simple & Elegant Guest Checkout Details */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Interactive Delivery Speed & PIN Code Estimator */}
            <div
              className="checkout-card"
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: '2px',
                padding: '24px',
                background: '#fff',
              }}
            >
              <h3
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.01em',
                  margin: '0 0 6px',
                  color: '#000',
                }}
              >
                Estimated Delivery Timeline
              </h3>
              <p
                style={{ fontSize: '0.78rem', color: '#666', margin: '0 0 16px', lineHeight: 1.4 }}
              >
                Check courier transit days and serviceability for your postal PIN code:
              </p>

              <div
                className="checkout-pincode-form"
                style={{
                  display: 'flex',
                  gap: '8px',
                  maxWidth: '100%',
                  marginBottom: serviceability || checkingPincode ? '12px' : '0',
                }}
              >
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter your 6-digit PIN Code"
                  value={guestPincodeInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setGuestPincodeInput(val);
                    if (val.length === 6) {
                      handleCheckPincode(val);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    border: '1px solid #d9d9d9',
                    fontSize: '0.8rem',
                    color: '#333',
                    outline: 'none',
                    borderRadius: '2px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleCheckPincode(guestPincodeInput)}
                  disabled={checkingPincode || guestPincodeInput.length !== 6}
                  className="checkout-pincode-btn"
                  style={{
                    background: '#4233d7',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    cursor:
                      guestPincodeInput.length === 6 && !checkingPincode
                        ? 'pointer'
                        : 'not-allowed',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap',
                    opacity: guestPincodeInput.length === 6 ? 1 : 0.85,
                    transition: 'background 0.2s ease',
                  }}
                >
                  {checkingPincode ? 'Checking...' : 'Check Delivery'}
                </button>
              </div>

              {/* Serviceability Result */}
              {checkingPincode ? (
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: '#666',
                    fontStyle: 'italic',
                    marginTop: '10px',
                  }}
                >
                  Checking courier coverage...
                </div>
              ) : serviceability ? (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: serviceability.serviceable ? '#f6ffed' : '#fff2f0',
                    border: `1px solid ${serviceability.serviceable ? '#b7eb8f' : '#ffccc7'}`,
                    fontSize: '0.74rem',
                    color: serviceability.serviceable ? '#389e0d' : '#cf1322',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '2px',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                    {serviceability.serviceable ? '✓' : '✕'}
                  </span>
                  <div>
                    <span>
                      {serviceability.serviceable
                        ? `Delivery available${serviceability.city ? ` to ${serviceability.city.toUpperCase()}${serviceability.state ? `, ${serviceability.state.toUpperCase()}` : ''}` : ''} (PIN ${serviceability.pincode}) via ${serviceability.courier_name || 'Ekart Logistics Air'} (Est. ${serviceability.estimated_days || `${serviceability.estimated_delivery_days || 3} business days`})`
                        : serviceability.message ||
                          `Delivery is not serviceable to PIN ${serviceability.pincode}`}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 3. Returning Athlete Sign-In Strip */}
            <div
              className="checkout-signin-strip"
              style={{
                border: '1px solid #e5e5e5',
                background: '#fff',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                borderRadius: '2px',
              }}
            >
              <span style={{ fontSize: '0.74rem', color: '#666' }}>
                Already have a VAHN Athlete account?
              </span>
              <button
                type="button"
                onClick={() => openAuthModal()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4233d7',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Sign In for Saved Addresses
              </button>
            </div>
          </div>
        )}

        {/* Right Column: Order Summary & Pay CTA */}
        <div>
          <div
            className="checkout-card checkout-summary-card"
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '2px',
              padding: '24px',
              background: '#fff',
              position: 'sticky',
              top: '100px',
            }}
          >
            <h2
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.01em',
                margin: '0 0 20px',
                color: '#000',
              }}
            >
              Order Summary ({totalQuantity} {totalQuantity === 1 ? 'Item' : 'Items'})
            </h2>

            {/* Cart Items list */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '380px',
                overflowY: 'auto',
                marginBottom: '16px',
                paddingRight: '4px',
              }}
            >
              {cartLines.map((line) => {
                const colorOption = line.merchandise.selectedOptions?.find((opt) =>
                  /colou?r/i.test(opt.name)
                )?.value;
                const sizeOption = line.merchandise.selectedOptions?.find((opt) =>
                  /size/i.test(opt.name)
                )?.value;

                let displayColor = colorOption;
                let displaySize = sizeOption;
                if (
                  !displayColor &&
                  !displaySize &&
                  line.merchandise.title &&
                  line.merchandise.title !== 'Default Title'
                ) {
                  const parts = line.merchandise.title.split('/').map((p) => p.trim());
                  if (parts.length === 2) {
                    displayColor = parts[0];
                    displaySize = parts[1];
                  } else {
                    displayColor = line.merchandise.title;
                  }
                }

                const imageUrl =
                  line.merchandise.image?.url || line.merchandise.product.featuredImage?.url;

                return (
                  <div
                    key={line.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid #eeeeee',
                      paddingBottom: '16px',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: 60,
                        height: 75,
                        flexShrink: 0,
                        background: '#f7f7f7',
                      }}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={line.merchandise.product.title}
                          fill
                          sizes="60px"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            color: '#999',
                          }}
                        >
                          VAHN
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            textTransform: 'uppercase',
                            color: '#000',
                            lineHeight: 1.3,
                            letterSpacing: '0.01em',
                          }}
                        >
                          {line.merchandise.product.title}
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            whiteSpace: 'nowrap',
                            color: '#000',
                            textAlign: 'right',
                          }}
                        >
                          ₹{' '}
                          {(
                            parseFloat(line.merchandise.price.amount) * line.quantity
                          ).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: '#777',
                          marginTop: '6px',
                          lineHeight: 1.5,
                        }}
                      >
                        {displayColor && <div>Colour: {displayColor}</div>}
                        {displaySize && <div>Size: {displaySize}</div>}
                        <div>Quantity: {line.quantity}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculations */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.78rem',
                color: '#777',
                borderBottom: '1px solid #e5e5e5',
                paddingBottom: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  SUBTOTAL
                </span>
                <span style={{ color: '#000', fontWeight: 600 }}>
                  ₹ {subtotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  SHIPPING
                </span>
                <span style={{ color: shippingFee === 0 ? '#4233d7' : '#000', fontWeight: 700 }}>
                  {shippingFee === 0 ? 'FREE' : `₹ ${shippingFee.toLocaleString('en-IN')}`}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  ESTIMATED GST INCLUDED
                </span>
                <span style={{ color: '#000', fontWeight: 600 }}>
                  ₹ {estimatedTax.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 800,
                fontSize: '0.95rem',
                padding: '16px 0',
                color: '#000',
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}>TOTAL</span>
              <span style={{ fontWeight: 800 }}>₹ {grandTotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Pay Button */}
            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={placingOrder}
              className="checkout-pay-btn"
              style={{
                width: '100%',
                background: placingOrder ? '#888' : '#4233d7',
                color: '#fff',
                border: 'none',
                padding: '13px 20px',
                fontSize: '0.92rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: placingOrder ? 'not-allowed' : 'pointer',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.2s ease',
              }}
            >
              {placingOrder ? (
                <span>Connecting to Gateway...</span>
              ) : (
                <>
                  <Image
                    src="/assets/Fast-checkout.png"
                    alt="Fast Checkout"
                    width={15}
                    height={18}
                    style={{ width: 'auto', height: '18px', objectFit: 'contain' }}
                  />
                  <span>PAY ₹ {grandTotal.toLocaleString('en-IN')}</span>
                </>
              )}
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '12px',
                fontSize: '0.74rem',
                color: '#777',
              }}
            >
              <ShieldCheckIcon size={14} color="#52c41a" />
              <span>Checkout in seconds · UPI & cards</span>
            </div>

            {/* Trust badges */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginTop: '16px',
              }}
            >
              {[
                { icon: <LockIcon size={16} color="#4233d7" />, label: 'SECURE PAYMENT' },
                { icon: <TruckIcon size={16} color="#4233d7" />, label: 'PAN INDIA SHIPPING' },
                { icon: <PackageIcon size={16} color="#4233d7" />, label: '10-DAY RETURNS' },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 6px',
                    background: '#f9f9fd',
                    border: '1px solid #e8e8f0',
                    borderRadius: '4px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#222',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    minHeight: '62px',
                  }}
                >
                  {icon}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Address Modal (for logged-in users) */}
      {showAddressModal && token && (
        <AddressModal
          token={token}
          isOpen={showAddressModal}
          initialAddress={editingAddress}
          onClose={() => setShowAddressModal(false)}
          onSuccess={() => {
            setShowAddressModal(false);
            loadAddresses();
          }}
        />
      )}
    </div>
  );
}
