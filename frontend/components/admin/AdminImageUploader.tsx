"use client";

import { useState } from "react";
import Image from "next/image";
import { uploadFileToS3 } from "@/lib/s3";

export interface UploadedImage {
  url: string;
  key: string;
  name: string;
  file?: File;
  isPending?: boolean;
}

/**
 * Uploads any pending local files to Amazon S3.
 * Call this inside handleSave / handleSubmit upon form submission.
 */
export async function uploadPendingImages(
  images: UploadedImage[],
  folder = "products",
  adminToken?: string
): Promise<UploadedImage[]> {
  const result: UploadedImage[] = [];
  for (const img of images) {
    if (img.file) {
      const uploaded = await uploadFileToS3(img.file, folder, adminToken);
      result.push({
        url: uploaded.url,
        key: uploaded.key,
        name: img.name || uploaded.name,
      });
    } else {
      result.push({
        url: img.url,
        key: img.key || img.url,
        name: img.name,
      });
    }
  }
  return result;
}

interface AdminImageUploaderProps {
  endpoint?: "productImage" | "lookbookImage" | "collectionImage" | string;
  folder?: string;
  onUploadComplete: (images: UploadedImage[]) => void;
  maxImages?: number;
  existingImages?: UploadedImage[];
  onReorderExisting?: (images: UploadedImage[]) => void;
  label?: string;
}

export default function AdminImageUploader({
  folder = "products",
  onUploadComplete,
  maxImages = 10,
  existingImages = [],
  onReorderExisting,
  label = "Upload Images",
}: AdminImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [localUploadedImages, setLocalUploadedImages] = useState<UploadedImage[]>([]);
  const [dragOverZone, setDragOverZone] = useState(false);
  const [error, setError] = useState("");

  // Card Drag and Drop Reordering State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverCardIndex, setDragOverCardIndex] = useState<number | null>(null);

  function handleFiles(files: File[]) {
    if (files.length === 0) return;
    const allowed = files.filter(f => f.type.startsWith("image/")).slice(0, maxImages);
    if (allowed.length === 0) {
      setError("Please select image files only.");
      return;
    }

    setError("");
    const formatted: UploadedImage[] = allowed.map(file => ({
      url: URL.createObjectURL(file),
      key: "",
      name: file.name,
      file: file,
      isPending: true,
    }));

    const currentList = existingImages.length > 0 ? existingImages : localUploadedImages;
    const next = [...currentList, ...formatted].slice(0, maxImages);
    setLocalUploadedImages(next);
    if (onReorderExisting) {
      onReorderExisting(next);
    } else {
      onUploadComplete(next);
    }
  }

  function handleZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOverZone(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }

  // Single unified list to render
  const displayedImages = existingImages.length > 0 ? existingImages : localUploadedImages;

  function handleMove(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= displayedImages.length) return;
    const next = [...displayedImages];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    setLocalUploadedImages(next);
    if (onReorderExisting) {
      onReorderExisting(next);
    } else {
      onUploadComplete(next);
    }
  }

  function handleRemove(index: number) {
    const next = displayedImages.filter((_, i) => i !== index);
    setLocalUploadedImages(next);
    if (onReorderExisting) {
      onReorderExisting(next);
    } else {
      onUploadComplete(next);
    }
  }

  // Card Drag & Drop Handlers
  function handleCardDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleCardDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCardIndex !== index) {
      setDragOverCardIndex(index);
    }
  }

  function handleCardDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      handleMove(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverCardIndex(null);
  }

  function handleCardDragEnd() {
    setDraggedIndex(null);
    setDragOverCardIndex(null);
  }

  const inputId = `admin-file-input-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="admin-uploader">
      <label className="admin-uploader-label">{label}</label>

      {/* Drop zone for new files */}
      <div
        className={`admin-uploader-zone ${dragOverZone ? "admin-uploader-zone--over" : ""} ${uploading ? "admin-uploader-zone--uploading" : ""}`}
        onDragOver={e => { e.preventDefault(); setDragOverZone(true); }}
        onDragLeave={() => setDragOverZone(false)}
        onDrop={handleZoneDrop}
        onClick={() => document.getElementById(inputId)?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && document.getElementById(inputId)?.click()}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          multiple={maxImages > 1}
          className="admin-uploader-input"
          onChange={e => handleFiles(Array.from(e.target.files || []))}
          style={{ display: "none" }}
        />
        {uploading ? (
          <div className="admin-uploader-uploading">
            <div className="admin-upload-spinner" />
            <span>Uploading to S3...</span>
          </div>
        ) : (
          <div className="admin-uploader-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="0"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="admin-uploader-hint">
              Bulk drag & drop files or <span className="admin-uploader-click">click to browse</span>
            </span>
            <span className="admin-uploader-info">PNG, JPG, WebP (Amazon S3 Storage)</span>
          </div>
        )}
      </div>

      {error && <div className="admin-uploader-error">{error}</div>}

      {/* Interactive Drag & Drop Reordering Grid */}
      {displayedImages.length > 0 && (
        <div>
          <span className="admin-form-hint" style={{ marginBottom: 6, display: "block" }}>
            💡 Drag & drop image boxes directly to re-order sequence
          </span>
          <div className="admin-reorder-grid">
            {displayedImages.map((img, i) => {
              const isDragging = draggedIndex === i;
              const isDropTarget = dragOverCardIndex === i && !isDragging;

              return (
                <div
                  key={img.key || img.url || i}
                  className={`admin-reorder-card ${isDragging ? "admin-reorder-card--dragging" : ""} ${isDropTarget ? "admin-reorder-card--target" : ""}`}
                  draggable
                  onDragStart={e => handleCardDragStart(e, i)}
                  onDragOver={e => handleCardDragOver(e, i)}
                  onDrop={e => handleCardDrop(e, i)}
                  onDragEnd={handleCardDragEnd}
                  style={{ cursor: "grab" }}
                >
                  <span className="admin-reorder-badge">#{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.name || `Image ${i + 1}`} width={96} height={96} style={{ width: 96, height: 96, objectFit: "cover", pointerEvents: "none" }} />
                  <div className="admin-reorder-actions" onClick={e => e.stopPropagation()}>
                    <button type="button" className="admin-reorder-btn" onClick={() => handleMove(i, i - 1)} disabled={i === 0} title="Move left">←</button>
                    <button type="button" className="admin-reorder-btn" onClick={() => handleMove(i, i + 1)} disabled={i === displayedImages.length - 1} title="Move right">→</button>
                    <button type="button" className="admin-reorder-btn admin-reorder-btn--delete" onClick={() => handleRemove(i)} title="Remove">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
