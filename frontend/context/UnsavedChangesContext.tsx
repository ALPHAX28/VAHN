"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface UnsavedChangesContextType {
  isDirty: boolean;
  setDirtyState: (
    dirty: boolean,
    onSaveHandler?: () => Promise<boolean | void>,
    onDiscardHandler?: () => void
  ) => void;
  confirmNavigation: (href: string) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  isDirty: false,
  setDirtyState: () => {},
  confirmNavigation: () => true,
});

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [onSave, setOnSave] = useState<(() => Promise<boolean | void>) | null>(null);
  const [onDiscard, setOnDiscard] = useState<(() => void) | null>(null);

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function setDirtyState(
    dirty: boolean,
    onSaveHandler?: () => Promise<boolean | void>,
    onDiscardHandler?: () => void
  ) {
    setIsDirty(dirty);
    if (onSaveHandler) setOnSave(() => onSaveHandler);
    if (onDiscardHandler) setOnDiscard(() => onDiscardHandler);
  }

  function confirmNavigation(href: string): boolean {
    if (!isDirty) return true;
    setPendingHref(href);
    setShowModal(true);
    return false;
  }

  async function handleSaveAndLeave() {
    setNavigating(true);
    if (onSave) {
      const ok = await onSave();
      if (ok === false) {
        setNavigating(false);
        return;
      }
    }
    setIsDirty(false);
    setShowModal(false);
    setNavigating(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }

  function handleDiscardAndLeave() {
    if (onDiscard) onDiscard();
    setIsDirty(false);
    setShowModal(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }

  // Prevent tab/browser refresh and browser Back/Forward navigation when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState(null, "", window.location.href);
        setShowModal(true);
      }
    };

    if (isDirty) {
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", handlePopState);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setDirtyState, confirmNavigation }}>
      {children}

      {/* GLOBAL UNSAVED NAVIGATION GUARD MODAL */}
      {showModal && (
        <div className="admin-modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, borderRadius: 0 }}>
            <h3 className="admin-modal-title" style={{ display: "flex", alignItems: "center", gap: 10, color: "#d32f2f" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Unsaved Changes Warning
            </h3>
            <p style={{ fontSize: "0.88rem", color: "var(--admin-text-secondary)", margin: "14px 0 22px", lineHeight: 1.5 }}>
              You have unsaved changes on this page. Switching pages or tabs without saving will discard your edits.
            </p>
            <div className="admin-modal-actions" style={{ flexDirection: "column", gap: 10 }}>
              <button
                className="admin-btn admin-btn--primary"
                style={{ width: "100%", padding: "11px" }}
                onClick={handleSaveAndLeave}
                disabled={navigating}
              >
                {navigating ? "Saving..." : "Save Changes & Leave Page →"}
              </button>
              <button
                className="admin-btn admin-btn--danger"
                style={{ width: "100%", padding: "11px" }}
                onClick={handleDiscardAndLeave}
              >
                Discard Edits & Leave Page
              </button>
              <button
                className="admin-btn admin-btn--ghost"
                style={{ width: "100%", marginTop: 4 }}
                onClick={() => setShowModal(false)}
              >
                Cancel (Stay on this page)
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}
