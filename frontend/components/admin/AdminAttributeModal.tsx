'use client';

import Image from 'next/image';
import type React from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { type AttributeOption, createAdminAttributeOption } from '@/lib/api/admin';
import { uploadFileToS3 } from '@/lib/s3';

interface AdminAttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (option: AttributeOption) => void;
  attributeType: 'FIT' | 'KIT_TYPE' | 'ACTIVITY';
  currentCategory: 'TOPS' | 'BOTTOMS' | 'ACCESSORIES';
  adminToken: string;
}

export default function AdminAttributeModal({
  isOpen,
  onClose,
  onCreated,
  attributeType,
  currentCategory,
  adminToken,
}: AdminAttributeModalProps) {
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

  if (!isOpen) return null;

  const typeLabels: Record<string, string> = {
    FIT: 'Fit Type',
    KIT_TYPE: 'Kit Type',
    ACTIVITY: 'Activity',
  };

  const handleClose = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl('');
    setIconUrl('');
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isPng = file.type === 'image/png';
    const isSvg = file.type === 'image/svg+xml';
    if (!isPng && !isSvg) {
      toast.error('Only transparent PNG or SVG files are allowed for attribute logos.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    // Immediate local preview without uploading to S3
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

      // Strictly upload to S3 ONLY when the user clicks Save
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

  return (
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          width: '100%',
          maxWidth: '540px',
          border: '1px solid #111111',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.25)',
          borderRadius: '0px',
          padding: '28px',
          animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
            marginBottom: '20px',
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
              Add New {typeLabels[attributeType]}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#666666' }}>
              Create an attribute option with custom brand logo for <strong>{category}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Warning Banner */}
        <div
          style={{
            backgroundColor: '#fff8e1',
            border: '1px solid #ffe082',
            padding: '12px 14px',
            marginBottom: '20px',
            borderRadius: '0px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
          <div style={{ fontSize: '0.8rem', color: '#5d4037', lineHeight: 1.4 }}>
            <strong>Transparent background is mandatory for logos:</strong> Please upload a
            high-resolution PNG or SVG with transparent background so icons blend cleanly into
            storefront product cards and PDP highlights.
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
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
                    width: '64px',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <Image
                    src={previewUrl || iconUrl}
                    alt="Attribute logo preview"
                    width={48}
                    height={48}
                    style={{ objectFit: 'contain', width: 'auto', height: '100%', maxHeight: 48 }}
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
                      ? 'Logo ready. It will be uploaded to S3 upon clicking Save.'
                      : 'Correctly sized to 48×48px icon footprint'}
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
                  PNG or SVG (shows instant local preview; uploads to S3 on Save)
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
    </div>
  );
}
