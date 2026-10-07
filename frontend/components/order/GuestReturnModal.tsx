'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  MapPinIcon,
  PackageIcon,
  ShieldCheckIcon,
  XIcon,
} from '@/components/icons/Icons';
import {
  checkReverseShippingServiceability,
  getOrderExchangeOptions,
  requestOrderReturn,
} from '@/lib/api';
import type {
  ExchangeItemOption,
  ExchangeVariantOption,
  OrderExchangeOptionsResponse,
  TrackingInfo,
} from '@/lib/api/types';

function extractVariantColour(v: ExchangeVariantOption, currentVariantTitle?: string): string {
  if (v.colour?.trim()) {
    return v.colour.trim();
  }
  if (v.title?.includes('/')) {
    const parts = v.title.split(/\s*\/\s*/);
    if (parts.length >= 2 && parts[0]?.trim()) {
      return parts[0].trim();
    }
  }
  if (currentVariantTitle?.includes('/')) {
    const parts = currentVariantTitle.split(/\s*\/\s*/);
    if (parts.length >= 2 && parts[0]?.trim()) {
      return parts[0].trim();
    }
  }
  return '';
}

function extractVariantSize(v: ExchangeVariantOption): string {
  if (v.size?.trim()) {
    return v.size.trim();
  }
  if (v.title?.includes('/')) {
    const parts = v.title.split(/\s*\/\s*/);
    if (parts.length >= 2 && parts[1]?.trim()) {
      return parts[1].trim();
    }
  }
  return v.title;
}

function getItemCurrentColour(item?: ExchangeItemOption | null): string {
  if (!item) return '';
  const currentVar = item.variants.find((v) => v.is_current);
  if (currentVar) {
    const c = extractVariantColour(currentVar, item.current_variant_title);
    if (c) return c;
  }
  if (item.current_variant_title?.includes('/')) {
    const parts = item.current_variant_title.split(/\s*\/\s*/);
    if (parts.length >= 2 && parts[0]?.trim()) {
      return parts[0].trim();
    }
  }
  const firstWithCol = item.variants.find((v) => extractVariantColour(v, item.current_variant_title));
  if (firstWithCol) {
    return extractVariantColour(firstWithCol, item.current_variant_title);
  }
  return '';
}

interface GuestReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  tracking: TrackingInfo;
  onSuccess: () => void;
}

export default function GuestReturnModal({
  isOpen,
  onClose,
  orderId,
  tracking,
  onSuccess,
}: GuestReturnModalProps) {
  // Verification State (Step 1)
  const [needsVerification, setNeedsVerification] = useState(true);
  const [contactInput, setContactInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Exchange/Return Selection State (Step 2)
  const [exchangeOptions, setExchangeOptions] = useState<OrderExchangeOptionsResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [actionType, setActionType] = useState<'REPLACEMENT' | 'RETURN'>('REPLACEMENT');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [selectedVariantTitle, setSelectedVariantTitle] = useState('');
  const [returnReason, setReturnReason] = useState('SIZE_FIT');
  const [returnNotes, setReturnNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Verified credentials to pass with the request
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [revServiceable, setRevServiceable] = useState<{
    serviceable: boolean;
    courierName?: string;
    message?: string;
  } | null>(null);

  const loadOptions = React.useCallback(
    async (token?: string, email?: string, phone?: string) => {
      setLoadingOptions(true);
      setSubmitError('');
      try {
        const res = await getOrderExchangeOptions(orderId, token, email, phone);
        setExchangeOptions(res);
        if (res.items && res.items.length > 0) {
          const firstItem = res.items[0];
          setSelectedItemId(firstItem.item_id);
          const initialColour = getItemCurrentColour(firstItem);
          setSelectedColour(initialColour);

          const matchingVariants = initialColour
            ? firstItem.variants.filter((v) => {
                const c = extractVariantColour(v, firstItem.current_variant_title);
                return !c || c.toLowerCase() === initialColour.toLowerCase();
              })
            : firstItem.variants;

          const firstAvailable = matchingVariants.find((v) => v.is_available && !v.is_current);
          if (firstAvailable) {
            setSelectedVariantId(firstAvailable.variant_id);
            setSelectedVariantTitle(firstAvailable.title);
          } else {
            setSelectedVariantId('');
            setSelectedVariantTitle('');
          }
        }
      } catch (err: unknown) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : 'Failed to retrieve order items. Please verify your contact information.'
        );
      } finally {
        setLoadingOptions(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    if (!isOpen) return;

    // Reset error states
    setVerifyError('');
    setSubmitError('');

    // Check if user is logged in
    const token = typeof window !== 'undefined' ? localStorage.getItem('vahn_auth_token') : null;

    // Pre-populate contact input if tracking already has email/phone
    const prefilledEmail = tracking.customer_email || '';
    const prefilledPhone = tracking.customer_phone || '';
    if (prefilledEmail) {
      setContactInput(prefilledEmail);
    } else if (prefilledPhone) {
      setContactInput(prefilledPhone);
    }

    if (token) {
      // Authenticated user: skip manual verification prompt
      setNeedsVerification(false);
      loadOptions(token);
    } else {
      setNeedsVerification(true);
    }

    // Verify reverse pickup serviceability for delivery pincode
    const rawAddr = tracking.shipping_address as Record<string, string> | undefined;
    const pin = rawAddr?.pincode || rawAddr?.postalCode;
    if (pin && String(pin).trim().length === 6) {
      checkReverseShippingServiceability(String(pin).trim())
        .then((res) => {
          setRevServiceable({
            serviceable: res.serviceable,
            courierName: res.courier_name || undefined,
            message: res.message || undefined,
          });
        })
        .catch(() => {
          setRevServiceable(null);
        });
    }
  }, [isOpen, tracking, loadOptions]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = contactInput.trim();
    if (!trimmed) {
      setVerifyError('Please enter the email address or 10-digit mobile number used at checkout.');
      return;
    }

    setVerifying(true);
    setVerifyError('');

    const isEmail = trimmed.includes('@');
    const emailParam = isEmail ? trimmed.toLowerCase() : undefined;
    const phoneParam = !isEmail ? trimmed.replace(/\D/g, '').slice(-10) : undefined;

    if (!isEmail && phoneParam?.length !== 10) {
      setVerifyError('Please enter a valid 10-digit mobile number or email address.');
      setVerifying(false);
      return;
    }

    try {
      const res = await getOrderExchangeOptions(orderId, undefined, emailParam, phoneParam);
      setExchangeOptions(res);
      setVerifiedEmail(emailParam || '');
      setVerifiedPhone(phoneParam || '');
      setNeedsVerification(false);

      if (res.items && res.items.length > 0) {
        const firstItem = res.items[0];
        setSelectedItemId(firstItem.item_id);
        const initialColour = getItemCurrentColour(firstItem);
        setSelectedColour(initialColour);

        const matchingVariants = initialColour
          ? firstItem.variants.filter((v) => {
              const c = extractVariantColour(v, firstItem.current_variant_title);
              return !c || c.toLowerCase() === initialColour.toLowerCase();
            })
          : firstItem.variants;

        const firstAvailable = matchingVariants.find((v) => v.is_available && !v.is_current);
        if (firstAvailable) {
          setSelectedVariantId(firstAvailable.variant_id);
          setSelectedVariantTitle(firstAvailable.title);
        } else {
          setSelectedVariantId('');
          setSelectedVariantTitle('');
        }
      }
    } catch (err: unknown) {
      setVerifyError(
        err instanceof Error
          ? err.message
          : `Verification failed. The email or mobile number does not match Order #${orderId}`
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (actionType === 'REPLACEMENT' && !selectedVariantId) {
      setSubmitError('Please select a replacement size, or switch to Return for 100% Refund.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('vahn_auth_token') || undefined
        : undefined;

    try {
      const res = await requestOrderReturn(
        orderId,
        {
          action: actionType,
          reason: returnReason,
          notes: returnNotes.trim() || undefined,
          order_item_id: selectedItemId || undefined,
          replacement_variant_id: actionType === 'REPLACEMENT' ? selectedVariantId : undefined,
          customer_email: verifiedEmail || undefined,
          customer_phone: verifiedPhone || undefined,
        },
        token
      );

      const awbMsg = res.reverseAwb ? ` (Reverse AWB: ${res.reverseAwb})` : '';
      if (actionType === 'REPLACEMENT') {
        toast.success(
          `Size replacement scheduled! ${selectedVariantTitle} reserved in warehouse. Doorstep pickup scheduled${awbMsg}.`
        );
      } else {
        toast.success(
          `Return initiated successfully! Automated doorstep pickup scheduled${awbMsg}. 100% refund will disburse upon courier pickup.`
        );
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Failed to schedule reverse pickup. Please verify the 10-day return window or contact support.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const currentItem: ExchangeItemOption | undefined =
    exchangeOptions?.items?.find((i) => i.item_id === selectedItemId) ||
    exchangeOptions?.items?.[0];

  // Extract all unique colours for this product item
  const availableColours = React.useMemo(() => {
    if (!currentItem) return [];
    const set = new Set<string>();
    for (const v of currentItem.variants) {
      const c = extractVariantColour(v, currentItem.current_variant_title);
      if (c) set.add(c);
    }
    return Array.from(set);
  }, [currentItem]);

  // Sync selectedColour with currentItem if unset or invalid
  useEffect(() => {
    if (currentItem && availableColours.length > 0) {
      const currCol = getItemCurrentColour(currentItem);
      if (!selectedColour || !availableColours.some((c) => c.toLowerCase() === selectedColour.toLowerCase())) {
        setSelectedColour(currCol || availableColours[0]);
      }
    }
  }, [currentItem, availableColours, selectedColour]);

  // Handler when customer taps a colour
  const handleColourChange = (colour: string) => {
    setSelectedColour(colour);
    if (!currentItem) return;

    const colourVariants = currentItem.variants.filter((v) => {
      const c = extractVariantColour(v, currentItem.current_variant_title);
      return !c || c.toLowerCase() === colour.toLowerCase();
    });

    const currentSelectedVar = currentItem.variants.find((v) => v.variant_id === selectedVariantId);
    const targetSize = currentSelectedVar ? extractVariantSize(currentSelectedVar) : '';

    const sameSizeVariant = colourVariants.find(
      (v) => extractVariantSize(v).toLowerCase() === targetSize.toLowerCase() && v.is_available && !v.is_current
    );

    if (sameSizeVariant) {
      setSelectedVariantId(sameSizeVariant.variant_id);
      setSelectedVariantTitle(sameSizeVariant.title);
    } else {
      const firstAvail = colourVariants.find((v) => v.is_available && !v.is_current);
      if (firstAvail) {
        setSelectedVariantId(firstAvail.variant_id);
        setSelectedVariantTitle(firstAvail.title);
      } else {
        setSelectedVariantId('');
        setSelectedVariantTitle('');
      }
    }
  };

  // Filter variants to show in size grid (never show duplicates from other colours)
  const displayedVariants = React.useMemo(() => {
    if (!currentItem) return [];
    if (!selectedColour || availableColours.length <= 1) {
      return currentItem.variants;
    }
    return currentItem.variants.filter((v) => {
      const c = extractVariantColour(v, currentItem.current_variant_title);
      return !c || c.toLowerCase() === selectedColour.toLowerCase();
    });
  }, [currentItem, selectedColour, availableColours]);

  const selectedVariantObj = currentItem?.variants.find((v) => v.variant_id === selectedVariantId);
  const activeImage =
    selectedVariantObj?.image_url ||
    displayedVariants.find((v) => v.image_url)?.image_url ||
    currentItem?.image_url;

  const addr = tracking.shipping_address as Record<string, string> | undefined;
  const addressLine = addr
    ? [addr.street_address || addr.address, addr.city, addr.pincode || addr.postalCode]
        .filter(Boolean)
        .join(', ')
    : 'Doorstep Delivery Address';

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <button
        type="button"
        aria-label="Close modal backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
      />
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: 620,
          border: '2px solid #000000',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          position: 'relative',
          zIndex: 1,
          padding: 'clamp(16px, 4vw, 32px)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #eeeeee',
            paddingBottom: '16px',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.3rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                margin: 0,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {actionType === 'REPLACEMENT'
                ? 'Size Replacement & Exchange'
                : 'Return for 100% Refund'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>
              Order #{orderId} &bull; Delivered {tracking.delivered_at || 'Recently'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#666',
            }}
            aria-label="Close"
          >
            <XIcon size={20} color="#000" />
          </button>
        </div>

        {/* Step 1: Guest Verification */}
        {needsVerification ? (
          <div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                  color: '#0f172a',
                }}
              >
                Security Verification
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                To authorize a return or size exchange for this order, please enter the email
                address or 10-digit mobile number associated with your purchase.
              </p>
            </div>

            {verifyError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircleIcon size={16} color="#dc2626" />
                <span>{verifyError}</span>
              </div>
            )}

            <form onSubmit={handleVerify}>
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="contactInput"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 6,
                  }}
                >
                  Order Email or 10-Digit Mobile Number
                </label>
                <input
                  id="contactInput"
                  type="text"
                  value={contactInput}
                  onChange={(e) => setContactInput(e.target.value)}
                  placeholder="e.g. athlete@vahnsports.com or 9876543210"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #000',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div
                style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#fff',
                    border: '1px solid #ccc',
                    padding: '10px 20px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    flex: '0 1 auto',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying || !contactInput.trim()}
                  style={{
                    background: '#000',
                    color: '#fff',
                    border: '2px solid #000',
                    padding: '10px 24px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: verifying ? 'not-allowed' : 'pointer',
                    opacity: verifying ? 0.7 : 1,
                    flex: '1 1 auto',
                    textAlign: 'center',
                  }}
                >
                  {verifying ? 'Verifying...' : 'Verify & Continue →'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step 2: Return or Replacement Selection */
          <div>
            {loadingOptions ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
                Loading order items and available sizes...
              </div>
            ) : (
              <form onSubmit={handleSubmitReturn}>
                {submitError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      color: '#991b1b',
                      padding: '12px 16px',
                      marginBottom: '18px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircleIcon size={16} color="#dc2626" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Mode Selector Tabs */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 10,
                    marginBottom: '22px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActionType('REPLACEMENT')}
                    style={{
                      background: actionType === 'REPLACEMENT' ? '#000000' : '#f5f5f5',
                      color: actionType === 'REPLACEMENT' ? '#fff' : '#333',
                      border: `2px solid ${actionType === 'REPLACEMENT' ? '#000000' : '#e5e5e5'}`,
                      padding: '12px 16px',
                      fontSize: '0.82rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    Exchange Size
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType('RETURN')}
                    style={{
                      background: actionType === 'RETURN' ? '#000000' : '#f5f5f5',
                      color: actionType === 'RETURN' ? '#fff' : '#333',
                      border: `2px solid ${actionType === 'RETURN' ? '#000000' : '#e5e5e5'}`,
                      padding: '12px 16px',
                      fontSize: '0.82rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    Return for Refund
                  </button>
                </div>

                {/* Item Summary */}
                {currentItem && (
                  <div
                    style={{
                      border: '1px solid #e5e5e5',
                      padding: '16px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      background: '#fafafa',
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        position: 'relative',
                        background: '#eee',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {activeImage ? (
                        <Image
                          src={activeImage}
                          alt={currentItem.product_title}
                          fill
                          sizes="64px"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: '#999',
                          }}
                        >
                          <PackageIcon size={24} color="#999" />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#111',
                        }}
                      >
                        {currentItem.product_title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#666', marginTop: 2 }}>
                        Current Size / Variant:{' '}
                        <strong>{currentItem.current_variant_title || 'Original'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Variant Selection for REPLACEMENT */}
                {actionType === 'REPLACEMENT' && currentItem && (
                  <div style={{ marginBottom: '20px' }}>
                    {/* Colour Selector */}
                    {availableColours.length > 1 && (
                      <div style={{ marginBottom: '18px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              fontSize: '0.75rem',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              color: '#000000',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Select Replacement Colour
                          </span>
                          {selectedColour && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                color: '#555',
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                              }}
                            >
                              Selected: <strong style={{ color: '#000' }}>{selectedColour}</strong>
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          {availableColours.map((col) => {
                            const isColSelected = selectedColour.toLowerCase() === col.toLowerCase();
                            const currentPurchasedCol = getItemCurrentColour(currentItem).toLowerCase();
                            const isCurrentColour = col.toLowerCase() === currentPurchasedCol;
                            const colVariants = currentItem.variants.filter(
                              (v) =>
                                extractVariantColour(v, currentItem.current_variant_title).toLowerCase() ===
                                col.toLowerCase()
                            );
                            const hasAvailableStock = colVariants.some(
                              (v) => v.is_available && !v.is_current
                            );

                            return (
                              <button
                                key={col}
                                type="button"
                                onClick={() => handleColourChange(col)}
                                style={{
                                  padding: '8px 16px',
                                  border: isColSelected ? '2px solid #000000' : '1px solid #cbd5e1',
                                  background: isColSelected ? '#000000' : '#ffffff',
                                  color: isColSelected ? '#ffffff' : '#0f172a',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.03em',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span>{col}</span>
                                {isCurrentColour && (
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      background: isColSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                      color: isColSelected ? '#ffffff' : '#64748b',
                                      borderRadius: 2,
                                    }}
                                  >
                                    Current
                                  </span>
                                )}
                                {!hasAvailableStock && (
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      color: isColSelected ? '#fca5a5' : '#ef4444',
                                    }}
                                  >
                                    (Low Stock)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Replacement Size Grid */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <label
                        htmlFor="replacementVariantSelect"
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          color: '#000000',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Select New Replacement Size
                      </label>
                      {selectedVariantTitle && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#555',
                            textTransform: 'uppercase',
                          }}
                        >
                          Selected: <strong style={{ color: '#000' }}>{selectedVariantTitle}</strong>
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {displayedVariants.map((v) => {
                        const isSelected = selectedVariantId === v.variant_id;
                        const isAvailable = v.is_available && !v.is_current;
                        const sizeLabel = extractVariantSize(v);

                        return (
                          <button
                            key={v.variant_id}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              setSelectedVariantId(v.variant_id);
                              setSelectedVariantTitle(v.title);
                            }}
                            style={{
                              border: isSelected
                                ? '2px solid #000000'
                                : `1px solid ${isAvailable ? '#cbd5e1' : '#f1f5f9'}`,
                              background: isSelected
                                ? '#000000'
                                : isAvailable
                                  ? '#ffffff'
                                  : '#f8fafc',
                              color: isSelected ? '#ffffff' : isAvailable ? '#0f172a' : '#94a3b8',
                              padding: '10px 8px',
                              textAlign: 'center',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              position: 'relative',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ fontWeight: 900, fontSize: '0.88rem' }}>
                              {sizeLabel}
                            </div>
                            <div
                              style={{
                                fontSize: '0.68rem',
                                marginTop: 2,
                                fontWeight: 700,
                                color: isSelected ? '#ffffff' : isAvailable ? '#16a34a' : '#94a3b8',
                              }}
                            >
                              {v.is_current
                                ? 'Current Size'
                                : isAvailable
                                  ? 'In Stock'
                                  : 'Out of Stock'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Return Reason Dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="returnReasonSelect"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                    }}
                  >
                    Reason for {actionType === 'REPLACEMENT' ? 'Exchange' : 'Return'}
                  </label>
                  <select
                    id="returnReasonSelect"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #ccc',
                      fontSize: '0.85rem',
                      background: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    <option value="SIZE_FIT">Size / Fit Issue (Too Small / Large)</option>
                    <option value="DEFECTIVE">Defective or Damaged Item</option>
                    <option value="WRONG_ITEM">Received Different Item than Ordered</option>
                    <option value="STYLE_QUALITY">Style or Fabric Quality Expectation</option>
                    <option value="CHANGED_MIND">Changed Mind / Preference</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                {/* Optional Notes */}
                <div style={{ marginBottom: '18px' }}>
                  <label
                    htmlFor="returnNotesTextarea"
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                    }}
                  >
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="returnNotesTextarea"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Provide any additional comments for our logistics team..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #ccc',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Doorstep Quality Check (QC) Advisory Banner */}
                {actionType === 'REPLACEMENT' && (
                  <div
                    style={{
                      background: '#f9f9f9',
                      border: '1px solid #e5e5e5',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: '0.78rem',
                      color: '#222222',
                      lineHeight: 1.4,
                    }}
                  >
                    <ShieldCheckIcon
                      size={18}
                      color="#000000"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <div>
                      <strong style={{ color: '#000000' }}>
                        Doorstep Quality Check (QC) Active:
                      </strong>
                      <div style={{ marginTop: 2 }}>
                        Please keep the item <strong>unworn</strong>, <strong>unwashed</strong>,
                        with <strong>original tags & packaging intact</strong>. The courier partner
                        will perform a quick physical verification before handing over your
                        replacement unit.
                      </div>
                    </div>
                  </div>
                )}

                {/* Pickup Address Notice */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '12px 14px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: '0.78rem',
                    color: '#475569',
                  }}
                >
                  <MapPinIcon size={16} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>Doorstep Pickup Address:</strong>{' '}
                      {addressLine}
                    </div>
                    {revServiceable && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: '0.72rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {revServiceable.serviceable ? (
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>
                            &#10003; Reverse pickup serviceable
                            {revServiceable.courierName ? ` via ${revServiceable.courierName}` : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: 600 }}>
                            &#9888; Note:{' '}
                            {revServiceable.message ||
                              'Reverse pickup may require manual carrier routing.'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div
                  style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      background: '#fff',
                      border: '1px solid #ccc',
                      padding: '12px 20px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      flex: '0 1 auto',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: '#000000',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      fontSize: '0.82rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                      letterSpacing: '0.02em',
                      flex: '1 1 auto',
                      textAlign: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <span>
                      {submitting
                        ? 'Scheduling Doorstep Pickup...'
                        : actionType === 'REPLACEMENT'
                          ? 'Confirm & Schedule Exchange Pickup'
                          : 'Confirm & Schedule Return Pickup'}
                    </span>
                    {!submitting && (
                      <svg
                        className="btn-checkout-arrow"
                        aria-hidden="true"
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
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
