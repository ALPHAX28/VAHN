"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { uploadFileToS3 } from "@/lib/s3";

export interface LookbookItem {
  id: string;
  imageUrl: string;
  file?: File;
  title: string;
  description: string;
}

/**
 * Uploads any pending local files directly to Amazon S3 before saving to the database.
 * Call this inside handleSave / handleSaveAll.
 */
export async function uploadPendingLookbookImages(items: LookbookItem[]): Promise<LookbookItem[]> {
  const result: LookbookItem[] = [];

  for (const item of items) {
    if (item.file) {
      const uploaded = await uploadFileToS3(item.file, "lookbook");
      if (!uploaded.url) {
        throw new Error(`Failed to upload photo for lookbook card "${item.title}".`);
      }
      result.push({
        id: item.id,
        imageUrl: uploaded.url,
        title: item.title,
        description: item.description,
      });
    } else {
      result.push({
        id: item.id,
        imageUrl: item.imageUrl,
        title: item.title,
        description: item.description,
      });
    }
  }

  return result;
}

interface AdminLookbookManagerProps {
  items: LookbookItem[];
  onChange: (items: LookbookItem[]) => void;
}

export default function AdminLookbookManager({
  items,
  onChange,
}: AdminLookbookManagerProps) {
  // Modal / Form state for Add/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [dragOverZone, setDragOverZone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open modal to Add
  function handleOpenAdd() {
    setEditingId(null);
    setImageUrl("");
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setFormError("");
    setModalOpen(true);
  }

  // Open modal to Edit
  function handleOpenEdit(item: LookbookItem) {
    setEditingId(item.id);
    setImageUrl(item.imageUrl);
    setSelectedFile(item.file || null);
    setTitle(item.title);
    setDescription(item.description);
    setFormError("");
    setModalOpen(true);
  }

  // Handle local file selection (creates local blob URL for instant preview, NO network upload yet)
  function handleFileSelected(file: File) {
    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setSelectedFile(file);
    setFormError("");
  }

  // Save Item in Modal (Local update only - NO auto-save or upload to backend)
  function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedUrl = imageUrl.trim();

    if (!trimmedUrl && !selectedFile) {
      setFormError("Please upload or provide an image for the lookbook card.");
      return;
    }
    if (!trimmedTitle) {
      setFormError("Please provide a title (e.g. 'The Weekend Daily').");
      return;
    }
    if (!trimmedDesc) {
      setFormError("Please provide a description / styling notes (e.g. 'Wide-leg denim, cotton tee, tote bag').");
      return;
    }

    let nextItems: LookbookItem[];

    if (editingId) {
      // Update existing locally
      nextItems = items.map((it) =>
        it.id === editingId
          ? {
              ...it,
              imageUrl: trimmedUrl,
              file: selectedFile || (trimmedUrl === it.imageUrl ? it.file : undefined),
              title: trimmedTitle,
              description: trimmedDesc,
            }
          : it
      );
    } else {
      // Add new locally
      const newItem: LookbookItem = {
        id: `look-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        imageUrl: trimmedUrl,
        file: selectedFile || undefined,
        title: trimmedTitle,
        description: trimmedDesc,
      };
      nextItems = [...items, newItem];
    }

    onChange(nextItems);
    setModalOpen(false);
  }

  // Delete item locally (NO auto-save)
  function handleDelete(id: string, itemTitle: string) {
    if (!confirm(`Are you sure you want to delete "${itemTitle || "this lookbook item"}"?`)) return;
    const nextItems = items.filter((it) => it.id !== id);
    onChange(nextItems);
  }

  // Move up locally (NO auto-save)
  function handleMoveUp(index: number) {
    if (index <= 0) return;
    const next = [...items];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  }

  // Move down locally (NO auto-save)
  function handleMoveDown(index: number) {
    if (index >= items.length - 1) return;
    const next = [...items];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  }

  return (
    <div className="admin-lookbook-manager">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--color-black)" }}>
            Lookbook Cards (&ldquo;How He Wears It&rdquo;)
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "#666", margin: "4px 0 0" }}>
            Add styled outfit inspiration cards for this product. Selected photos preview locally and will only upload when you click &ldquo;Save Changes&rdquo;.
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={handleOpenAdd}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Lookbook Card
        </button>
      </div>

      {/* Items Grid / Empty State */}
      {items.length === 0 ? (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            background: "#f9f9fb",
            border: "1px dashed #d0d5dd",
            borderRadius: "4px",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#98a2b3"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto 12px", display: "block" }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <h4 style={{ margin: "0 0 6px", fontSize: "0.95rem", fontWeight: 700 }}>No Lookbook Cards Yet</h4>
          <p style={{ margin: "0 0 16px", fontSize: "0.8125rem", color: "#667085", maxWidth: "420px", marginInline: "auto" }}>
            Add outfit inspiration and style guides (e.g. &ldquo;The Weekend Daily&rdquo;, &ldquo;The Off-Day Fit&rdquo;) to show customers how this piece can be worn.
          </p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={handleOpenAdd}
          >
            + Add First Lookbook Card
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                background: "#ffffff",
                border: "1px solid #eaecf0",
                borderRadius: "4px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 1px 3px rgba(16, 24, 40, 0.05)",
                position: "relative",
              }}
            >
              {/* Card Image */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "3 / 4",
                  background: "#f2f4f7",
                }}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title || "Lookbook photo"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#98a2b3",
                      fontSize: "0.8rem",
                    }}
                  >
                    No Image
                  </div>
                )}

                {/* Index badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "#ffffff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "2px",
                  }}
                >
                  #{idx + 1}
                </div>

                {/* Pending Upload Indicator */}
                {item.file && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      background: "#f59e0b",
                      color: "#ffffff",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "2px",
                      letterSpacing: "0.02em",
                    }}
                    title="This photo will upload when you save the product"
                  >
                    Pending Save
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div style={{ padding: "12px", flex: 1, display: "flex", flexDirection: "column" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "0.92rem", fontWeight: 700, color: "#101828" }}>
                  {item.title || "Untitled Card"}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color: "#667085",
                    lineHeight: 1.4,
                    flex: 1,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {item.description || "No description provided"}
                </p>

                {/* Actions Toolbar */}
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "10px",
                    borderTop: "1px solid #f2f4f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                  }}
                >
                  {/* Reorder Buttons */}
                  <div style={{ display: "flex", gap: "3px" }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      className="admin-btn admin-btn--ghost"
                      style={{ padding: "4px 8px", fontSize: "0.75rem", opacity: idx === 0 ? 0.3 : 1 }}
                      title="Move Left/Up"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      className="admin-btn admin-btn--ghost"
                      style={{ padding: "4px 8px", fontSize: "0.75rem", opacity: idx === items.length - 1 ? 0.3 : 1 }}
                      title="Move Right/Down"
                    >
                      ▶
                    </button>
                  </div>

                  {/* Edit / Delete Buttons */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      onClick={() => handleOpenEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      style={{ padding: "4px 8px", fontSize: "0.78rem", color: "#d32f2f" }}
                      onClick={() => handleDelete(item.id, item.title)}
                      title="Delete card"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "6px",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #eaecf0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                {editingId ? "Edit Lookbook Card" : "Add Lookbook Card"}
              </h3>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                style={{ padding: "4px 8px", fontSize: "1.1rem" }}
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Error Alert */}
            {formError && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fef3f2",
                  border: "1px solid #fee4e2",
                  color: "#b42318",
                  fontSize: "0.8125rem",
                  borderRadius: "4px",
                  marginBottom: "16px",
                  fontWeight: 500,
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveItem}>
              {/* Image Selection / Preview */}
              <div className="admin-form-group" style={{ marginBottom: "16px" }}>
                <label className="admin-form-label" style={{ fontWeight: 600 }}>
                  Lookbook Photo *
                </label>

                {imageUrl ? (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      maxWidth: "200px",
                      aspectRatio: "3 / 4",
                      borderRadius: "4px",
                      overflow: "hidden",
                      border: "1px solid #d0d5dd",
                      marginBottom: "10px",
                      background: "#f9fafb",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Lookbook preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setSelectedFile(null);
                      }}
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        background: "rgba(0,0,0,0.75)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                      }}
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Hidden Native File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelected(e.target.files[0]);
                        }
                      }}
                    />

                    {/* Drag and Drop Zone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverZone(true);
                      }}
                      onDragLeave={() => setDragOverZone(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverZone(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileSelected(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: dragOverZone ? "2px dashed #000000" : "1.5px dashed #d0d5dd",
                        borderRadius: "6px",
                        padding: "24px 16px",
                        textAlign: "center",
                        backgroundColor: dragOverZone ? "#f9fafb" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#667085"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ margin: "0 auto 8px", display: "block" }}
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p style={{ margin: "0 0 4px", fontSize: "0.875rem", fontWeight: 600, color: "#101828" }}>
                        Click to select photo or drag and drop
                      </p>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#667085" }}>
                        PNG, JPG, WEBP up to 10MB (Uploads only when saving product)
                      </p>
                    </div>

                    {/* Direct Image URL input fallback */}
                    <div style={{ marginTop: "12px" }}>
                      <label style={{ fontSize: "0.75rem", color: "#667085", display: "block", marginBottom: "4px" }}>
                        Or enter an existing image URL:
                      </label>
                      <input
                        type="url"
                        className="admin-form-input"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl.startsWith("blob:") ? "" : imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          setSelectedFile(null);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="admin-form-group" style={{ marginBottom: "16px" }}>
                <label className="admin-form-label" style={{ fontWeight: 600 }}>
                  Title *
                </label>
                <input
                  type="text"
                  className="admin-form-input"
                  placeholder="e.g. The Weekend Daily, The Off-Day Fit"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              {/* Description */}
              <div className="admin-form-group" style={{ marginBottom: "20px" }}>
                <label className="admin-form-label" style={{ fontWeight: 600 }}>
                  Styling Description *
                </label>
                <textarea
                  className="admin-form-input"
                  rows={3}
                  placeholder="e.g. Wide-leg denim, cotton tee, tote bag"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={300}
                  style={{ resize: "vertical", minHeight: "70px" }}
                  required
                />
                <div style={{ fontSize: "0.72rem", color: "#98a2b3", textAlign: "right", marginTop: "2px" }}>
                  {description.length}/300
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  paddingTop: "14px",
                  borderTop: "1px solid #eaecf0",
                }}
              >
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                >
                  {editingId ? "Apply Changes" : "Add Card"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
