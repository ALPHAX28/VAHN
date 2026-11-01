'use client';

import Image from 'next/image';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type AttributeOption,
  createAdminAttributeOption,
  deleteAdminAttributeOption,
  getAdminAttributeOptions,
} from '@/lib/api/admin';
import { uploadFileToS3 } from '@/lib/s3';

interface AdminAttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (option: AttributeOption) => void;
  onDeleted?: (option: AttributeOption) => void;
  attributeType: 'FIT' | 'KIT_TYPE' | 'ACTIVITY';
  currentCategory: 'TOPS' | 'BOTTOMS' | 'ACCESSORIES';
  adminToken: string;
}

export default function AdminAttributeModal({
  isOpen,
  onClose,
  onCreated,
  onDeleted,
  attributeType,
  currentCategory,
  adminToken,
}: AdminAttributeModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'TOPS' | 'BOTTOMS' | 'ACCESSORIES' | 'ALL'>(
    currentCategory
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewBg, setPreviewBg] = useState<'checker-light' | 'checker-dark'>('checker-light');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing options management
  const [existingOptions, setExistingOptions] = useState<AttributeOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<AttributeOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const typeLabels: Record<string, string> = {
    FIT: 'Fit Type',
    KIT_TYPE: 'Kit Type',
    ACTIVITY: 'Activity',
  };

  const fetchExistingOptions = useCallback(async () => {
    if (!adminToken) return;
    try {
      setLoadingOptions(true);
      const opts = await getAdminAttributeOptions(adminToken, category, attributeType);
      setExistingOptions(opts);
    } catch {
      // Non-fatal
    } finally {
      setLoadingOptions(false);
    }
  }, [adminToken, category, attributeType]);

  useEffect(() => {
    if (isOpen) {
      fetchExistingOptions();
    }
  }, [isOpen, fetchExistingOptions]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl('');
    setIconUrl('');
    setOptionToDelete(null);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPng = file.type === 'image/png';
    const isSvg = file.type === 'image/svg+xml';
    if (!isPng && !isSvg) {
      toast.error('Only transparent PNG or SVG files are allowed for attribute logos.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(objectUrl);
    toast.success('Logo preview loaded! It will be uploaded to S3 upon clicking Save.');
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl('');
    setIconUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error('Please enter a name for the attribute.');
      return;
    }

    try {
      setIsSubmitting(true);
      let finalIconUrl = iconUrl;

      if (pendingFile) {
        toast.loading('Uploading logo to S3...', { id: 'attr-save-upload' });
        const uploaded = await uploadFileToS3(pendingFile, 'attributes', adminToken);
        finalIconUrl = uploaded.url;
      }

      const newOption = await createAdminAttributeOption(adminToken, {
        attribute_type: attributeType,
        category: category,
        name: cleanName,
        icon_url: finalIconUrl || undefined,
      });

      toast.success(`Created new ${typeLabels[attributeType]}: "${cleanName}"`, {
        id: 'attr-save-upload',
      });
      handleClose();
      onCreated(newOption);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create attribute option';
      toast.error(msg, { id: 'attr-save-upload' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!optionToDelete || !adminToken) return;
    try {
      setIsDeleting(true);
      await deleteAdminAttributeOption(adminToken, optionToDelete.id);
      toast.success(
        `Deleted "${optionToDelete.name}" and removed its associated image & references.`
      );
      onDeleted?.(optionToDelete);
      setOptionToDelete(null);
      await fetchExistingOptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete option';
      if (typeof msg === 'string' && (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('already removed'))) {
        onDeleted?.(optionToDelete);
        setOptionToDelete(null);
        await fetchExistingOptions();
        toast.success(`"${optionToDelete.name}" was already removed.`);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            width: '100%',
            maxWidth: '560px',
            border: '1px solid #111111',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
            borderRadius: '0px',
            padding: '24px 28px',
            animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #eeeeee',
              paddingBottom: '16px',
              marginBottom: '16px',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                  color: '#000000',
                }}
              >
                {typeLabels[attributeType]} Manager
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#666666' }}>
                Add new options or manage and delete existing ones for <strong>{category}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#666666',
                padding: '4px 8px',
                fontWeight: 700,
              }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid #e4e4e7',
              marginBottom: '18px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              style={{
                padding: '8px 16px',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: 'none',
                border: 'none',
                borderBottom:
                  activeTab === 'create' ? '2px solid #111111' : '2px solid transparent',
                color: activeTab === 'create' ? '#111111' : '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              + Add New {typeLabels[attributeType]}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('manage');
                fetchExistingOptions();
              }}
              style={{
                padding: '8px 16px',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: 'none',
                border: 'none',
                borderBottom:
                  activeTab === 'manage' ? '2px solid #111111' : '2px solid transparent',
                color: activeTab === 'manage' ? '#111111' : '#71717a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Manage & Delete</span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'manage' ? '#111111' : '#f4f4f5',
                  color: activeTab === 'manage' ? '#ffffff' : '#71717a',
                }}
              >
                {existingOptions.length}
              </span>
            </button>
          </div>

          {activeTab === 'create' ? (
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              {/* Warning Banner */}
              <div
                style={{
                  backgroundColor: '#fff8e1',
                  border: '1px solid #ffe082',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: '0px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
                <div style={{ fontSize: '0.78rem', color: '#5d4037', lineHeight: 1.4 }}>
                  <strong>Transparent background is mandatory for logos:</strong> Upload high-res
                  PNG or SVG so badges render cleanly across storefront highlights.
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Category Scoping */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '6px',
                      color: '#333333',
                    }}
                  >
                    Category Scope *
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                    }}
                  >
                    {(['TOPS', 'BOTTOMS', 'ACCESSORIES', 'ALL'] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setCategory(cat)}
                        style={{
                          padding: '8px 4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          textAlign: 'center',
                          border: category === cat ? '2px solid #111111' : '1px solid #cccccc',
                          backgroundColor: category === cat ? '#111111' : '#f9f9f9',
                          color: category === cat ? '#ffffff' : '#333333',
                          cursor: 'pointer',
                          borderRadius: '0px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#777777', marginTop: '4px' }}>
                    {category === currentCategory
                      ? `✓ Pre-selected for current product category (${category})`
                      : category === 'ALL'
                        ? 'Applies universally to Tops, Bottoms, and Accessories'
                        : `Scoped strictly to ${category}`}
                  </div>
                </div>

                {/* Name Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '6px',
                      color: '#333333',
                    }}
                  >
                    {typeLabels[attributeType]} Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      attributeType === 'FIT'
                        ? 'e.g. Tapered Fit, Compression, Relaxed'
                        : attributeType === 'KIT_TYPE'
                          ? 'e.g. Away, Goalkeeper, Training, Third'
                          : 'e.g. Running, Football, Lifestyle'
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '0px',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Logo Upload Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#333333',
                        margin: 0,
                      }}
                    >
                      Attribute Icon / Logo (Transparent PNG / SVG)
                    </label>
                    {(previewUrl || iconUrl) && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewBg((b) =>
                              b === 'checker-light' ? 'checker-dark' : 'checker-light'
                            )
                          }
                          style={{
                            fontSize: '0.7rem',
                            background: '#f0f0f0',
                            border: '1px solid #ccc',
                            borderRadius: '0px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Toggle {previewBg === 'checker-light' ? 'Dark' : 'Light'} Contrast
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          style={{
                            fontSize: '0.7rem',
                            background: 'none',
                            border: 'none',
                            color: '#d32f2f',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontWeight: 600,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/svg+xml"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />

                  {previewUrl || iconUrl ? (
                    <div
                      style={{
                        border: '1px solid #111111',
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        background:
                          previewBg === 'checker-light'
                            ? 'repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'
                            : 'repeating-conic-gradient(#222222 0% 25%, #333333 0% 50%) 50% / 16px 16px',
                      }}
                    >
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                        }}
                      >
                        <Image
                          src={previewUrl || iconUrl}
                          alt="Attribute logo preview"
                          width={44}
                          height={44}
                          style={{
                            objectFit: 'contain',
                            width: 'auto',
                            height: '100%',
                            maxHeight: 44,
                          }}
                          unoptimized
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: previewBg === 'checker-light' ? '#000000' : '#ffffff',
                          }}
                        >
                          {pendingFile
                            ? '✓ Local Preview Loaded (Pending Save)'
                            : '✓ Transparent Logo Loaded'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: previewBg === 'checker-light' ? '#555555' : '#aaaaaa',
                            marginTop: '2px',
                          }}
                        >
                          {pendingFile
                            ? 'Ready. Will be uploaded to S3 upon clicking Save.'
                            : '48×48px icon footprint'}
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            marginTop: '8px',
                            background: previewBg === 'checker-light' ? '#000000' : '#ffffff',
                            color: previewBg === 'checker-light' ? '#ffffff' : '#000000',
                            border: 'none',
                            borderRadius: '0px',
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Replace Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed #cccccc',
                        borderRadius: '0px',
                        padding: '24px 16px',
                        textAlign: 'center',
                        backgroundColor: '#fafafa',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '1.75rem', marginBottom: '8px' }}>📂</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111111' }}>
                        Click to Select Transparent Logo
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#777777', marginTop: '4px' }}>
                        PNG or SVG (instant local preview; uploads to S3 on Save)
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    borderTop: '1px solid #eeeeee',
                    paddingTop: '16px',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    style={{
                      padding: '10px 18px',
                      border: '1px solid #cccccc',
                      backgroundColor: '#ffffff',
                      color: '#333333',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      borderRadius: '0px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    style={{
                      padding: '10px 22px',
                      border: '1px solid #111111',
                      backgroundColor: '#111111',
                      color: '#ffffff',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting || !name.trim() ? 0.6 : 1,
                      borderRadius: '0px',
                    }}
                  >
                    {isSubmitting
                      ? pendingFile
                        ? 'Uploading & Saving...'
                        : 'Saving...'
                      : `Save ${typeLabels[attributeType]}`}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Manage / Delete Existing Options Tab */
            <div
              style={{
                overflowY: 'auto',
                flex: 1,
                paddingRight: '4px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#666666',
                  marginBottom: '12px',
                  lineHeight: 1.4,
                }}
              >
                Review and delete existing <strong>{typeLabels[attributeType]}</strong> options.
                Deleting an option permanently cleans up its uploaded images from S3 and clears the
                value from associated products.
              </div>

              {loadingOptions ? (
                <div
                  style={{
                    padding: '36px 0',
                    textAlign: 'center',
                    color: '#71717a',
                    fontSize: '0.875rem',
                  }}
                >
                  Loading options...
                </div>
              ) : existingOptions.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    border: '1px solid #e4e4e7',
                    backgroundColor: '#fafafa',
                    color: '#71717a',
                    fontSize: '0.85rem',
                  }}
                >
                  No {typeLabels[attributeType]} options found for this category scope.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {existingOptions.map((opt) => (
                    <div
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        border: '1px solid #e4e4e7',
                        backgroundColor: '#ffffff',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            backgroundColor: '#f4f4f5',
                            border: '1px solid #e4e4e7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {opt.icon_url ? (
                            <Image
                              src={opt.icon_url}
                              alt={opt.name}
                              width={28}
                              height={28}
                              style={{ objectFit: 'contain', maxHeight: 28, width: 'auto' }}
                              unoptimized
                            />
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>—</span>
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: '#09090b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {opt.name}
                          </div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#71717a',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginTop: '2px',
                            }}
                          >
                            <span>Code: {opt.code}</span>
                            <span>•</span>
                            <span
                              style={{
                                padding: '1px 5px',
                                background: '#f4f4f5',
                                borderRadius: '2px',
                                fontWeight: 700,
                              }}
                            >
                              {opt.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setOptionToDelete(opt)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: '#dc2626',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          cursor: 'pointer',
                          borderRadius: '0px',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (Standard Admin Modal Style) */}
      {optionToDelete && (
        <div
          className="admin-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !isDeleting && setOptionToDelete(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              border: '1px solid #111111',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35)',
            }}
          >
            <h3
              className="admin-modal-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#d32f2f',
                margin: '0 0 12px',
                fontSize: '1.1rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              Delete {typeLabels[attributeType]}
            </h3>
            <p
              style={{
                fontSize: '0.88rem',
                color: '#333333',
                margin: '0 0 14px',
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to permanently delete <strong>"{optionToDelete.name}"</strong>?
            </p>
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                padding: '10px 12px',
                fontSize: '0.78rem',
                color: '#b91c1c',
                marginBottom: '20px',
                lineHeight: 1.45,
              }}
            >
              ⚠️ <strong>Warning:</strong> If deleted, its respective logo image will be permanently
              deleted from storage, and this value will be cleared from any products currently using
              it.
            </div>
            <div
              className="admin-modal-actions"
              style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}
            >
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setOptionToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: '9px 16px',
                  border: '1px solid #cccccc',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: '1px solid #b91c1c',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
