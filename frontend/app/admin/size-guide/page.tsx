"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Image from "next/image";
import {
  adminListSizeGuide,
  adminCreateSizeGuideType,
  adminUpdateSizeGuideType,
  adminDeleteSizeGuideType,
  adminReorderSizeGuide,
  type SizeGuideType,
  type MeasuringTip,
} from "@/lib/api/sizeGuide";

function DiagramSVG() {
  return (
    <svg viewBox="0 0 200 240" width="100%" height="100%" style={{ maxWidth: 180 }}>
      <path d="M 60 40 L 40 48 L 20 80 L 45 92 L 55 75 L 55 210 L 145 210 L 145 75 L 155 92 L 180 80 L 160 48 L 140 40 C 130 52 110 52 100 52 C 90 52 70 52 60 40 Z" fill="none" stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M 60 40 C 70 52 90 52 100 52 C 110 52 130 52 140 40" fill="none" stroke="#000" strokeWidth="1.5" />
      <line x1="55" y1="120" x2="145" y2="120" stroke="#a42325" strokeWidth="2" strokeDasharray="4,4" />
      <text x="100" y="112" textAnchor="middle" fill="#a42325" fontSize="9" fontWeight="bold">A: CHEST</text>
      <line x1="100" y1="52" x2="100" y2="210" stroke="#a42325" strokeWidth="2" strokeDasharray="4,4" />
      <text x="94" y="140" textAnchor="end" fill="#a42325" fontSize="9" fontWeight="bold" transform="rotate(-90 94 140)">B: LENGTH</text>
      <line x1="140" y1="40" x2="180" y2="80" stroke="#a42325" strokeWidth="2" strokeDasharray="4,4" />
      <text x="148" y="53" fill="#a42325" fontSize="8" fontWeight="bold">C: SLEEVE</text>
    </svg>
  );
}

function emptyType(): Omit<SizeGuideType, "id"> {
  return { name: "", unit_label: "", is_visible: true, display_order: 0, diagram_image_url: null, columns: ["Size"], rows: [{ Size: "" }], measuring_tips: [] };
}

function makeEmptyRow(columns: string[]): Record<string, string> {
  return Object.fromEntries(columns.map((c) => [c, ""]));
}

export default function AdminSizeGuidePage() {
  const { adminToken } = useAdminAuth();
  const [types, setTypes] = useState<SizeGuideType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Omit<SizeGuideType, "id">>(emptyType());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    if (!adminToken) return;
    try { setLoading(true); setTypes(await adminListSizeGuide(adminToken)); }
    catch { setError("Failed to load size guide types."); }
    finally { setLoading(false); }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    const maxOrder = types.length > 0 ? Math.max(...types.map((t) => t.display_order)) + 1 : 0;
    setDraft({ ...emptyType(), display_order: maxOrder });
    setEditingId("new");
  }

  function openEdit(t: SizeGuideType) {
    setDraft({ name: t.name, unit_label: t.unit_label ?? "", is_visible: t.is_visible, display_order: t.display_order, diagram_image_url: t.diagram_image_url, columns: [...t.columns], rows: t.rows.map((r) => ({ ...r })), measuring_tips: t.measuring_tips.map((tip) => ({ ...tip })) });
    setEditingId(t.id);
  }

  async function handleSave() {
    if (!adminToken || !draft.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      const unitLabel = draft.unit_label || undefined;
      const unitLabelNullable = draft.unit_label || null;
      if (editingId === "new") {
        await adminCreateSizeGuideType(adminToken, { ...draft, unit_label: unitLabel });
        showToast("Measurement type created!");
      } else if (typeof editingId === "number") {
        await adminUpdateSizeGuideType(adminToken, editingId, { ...draft, unit_label: unitLabelNullable });
        showToast("Measurement type updated!");
      }
      setEditingId(null); await load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function toggleVisibility(t: SizeGuideType) {
    if (!adminToken) return;
    try { await adminUpdateSizeGuideType(adminToken, t.id, { is_visible: !t.is_visible }); showToast(t.is_visible ? "Hidden from storefront" : "Visible on storefront"); await load(); }
    catch { setError("Toggle failed."); }
  }

  async function handleDelete(id: number) {
    if (!adminToken) return;
    try { await adminDeleteSizeGuideType(adminToken, id); setConfirmDeleteId(null); showToast("Deleted."); await load(); }
    catch { setError("Delete failed."); }
  }

  async function move(idx: number, dir: -1 | 1) {
    if (!adminToken) return;
    const next = [...types];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const reordered = next.map((t, i) => ({ ...t, display_order: i }));
    setTypes(reordered);
    await adminReorderSizeGuide(adminToken, reordered.map((t) => ({ id: t.id, display_order: t.display_order })));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !adminToken) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/uploadthing", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data?.[0]?.url ?? data?.data?.[0]?.url ?? null;
      if (url) setDraft((d) => ({ ...d, diagram_image_url: url }));
    } catch { setError("Image upload failed."); }
    finally { setUploading(false); }
  }

  function addColumn() {
    const name = `Column ${draft.columns.length + 1}`;
    setDraft((d) => ({ ...d, columns: [...d.columns, name], rows: d.rows.map((r) => ({ ...r, [name]: "" })) }));
  }
  function renameColumn(idx: number, val: string) {
    const old = draft.columns[idx];
    setDraft((d) => ({ ...d, columns: d.columns.map((c, i) => (i === idx ? val : c)), rows: d.rows.map((r) => { const u = { ...r, [val]: r[old] ?? "" }; delete u[old]; return u; }) }));
  }
  function removeColumn(idx: number) {
    const col = draft.columns[idx];
    setDraft((d) => ({ ...d, columns: d.columns.filter((_, i) => i !== idx), rows: d.rows.map((r) => { const u = { ...r }; delete u[col]; return u; }) }));
  }
  function addRow() { setDraft((d) => ({ ...d, rows: [...d.rows, makeEmptyRow(d.columns)] })); }
  function removeRow(idx: number) { setDraft((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== idx) })); }
  function setCell(ri: number, col: string, val: string) { setDraft((d) => ({ ...d, rows: d.rows.map((r, i) => i === ri ? { ...r, [col]: val } : r) })); }
  function addTip() { setDraft((d) => ({ ...d, measuring_tips: [...d.measuring_tips, { title: "", description: "" }] })); }
  function setTip(idx: number, field: keyof MeasuringTip, val: string) { setDraft((d) => ({ ...d, measuring_tips: d.measuring_tips.map((t, i) => i === idx ? { ...t, [field]: val } : t) })); }
  function removeTip(idx: number) { setDraft((d) => ({ ...d, measuring_tips: d.measuring_tips.filter((_, i) => i !== idx) })); }

  return (
    <div className="admin-page">
      {toast && (<div style={{ position:"fixed",bottom:24,right:24,zIndex:9999,background:"#1a1a1a",color:"#fff",padding:"12px 20px",borderRadius:6,fontWeight:600,fontSize:"0.875rem",boxShadow:"0 4px 16px rgba(0,0,0,0.3)" }}>{toast}</div>)}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Size Guide</h1>
          <p className="admin-page-subtitle">Manage measurement types shown in the Size Guide modal on product pages.</p>
        </div>
        <button className="admin-btn admin-btn--primary" onClick={openCreate}>+ Add Measurement Type</button>
      </div>
      {error && (<div className="admin-alert admin-alert--error">{error}<button style={{marginLeft:12,background:"none",border:"none",cursor:"pointer",color:"inherit"}} onClick={() => setError("")}>✕</button></div>)}
      {loading ? (
        <div className="admin-loading-row"><div className="admin-loading-spinner" /><span>Loading...</span></div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          {types.length === 0 && editingId === null && (
            <div className="admin-card" style={{ textAlign:"center",padding:48 }}>
              <p style={{ color:"#888",marginBottom:16 }}>No measurement types yet.</p>
              <button className="admin-btn admin-btn--primary" onClick={openCreate}>+ Add First Type</button>
            </div>
          )}
          {types.map((t, idx) => (
            <div key={t.id} className="admin-card">
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 20px" }}>
                <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                  <button className="admin-btn" style={{ padding:"2px 8px",minHeight:0,fontSize:10 }} onClick={() => move(idx, -1)} disabled={idx === 0}>▲</button>
                  <button className="admin-btn" style={{ padding:"2px 8px",minHeight:0,fontSize:10 }} onClick={() => move(idx, 1)} disabled={idx === types.length - 1}>▼</button>
                </div>
                <div style={{ width:48,height:48,border:"1px solid #eee",borderRadius:4,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa" }}>
                  {t.diagram_image_url ? <Image src={t.diagram_image_url} alt={t.name} width={48} height={48} style={{ objectFit:"cover" }} /> : <DiagramSVG />}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,fontSize:"0.9375rem" }}>{t.name}</div>
                  <div style={{ fontSize:"0.75rem",color:"#888",marginTop:2 }}>{t.columns.length} columns · {t.rows.length} rows · {t.measuring_tips.length} tips</div>
                </div>
                <button onClick={() => toggleVisibility(t)} style={{ padding:"4px 12px",borderRadius:20,border:"none",fontWeight:700,fontSize:"0.7rem",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",background:t.is_visible?"#dcfce7":"#f3f4f6",color:t.is_visible?"#166534":"#6b7280" }}>{t.is_visible ? "Visible" : "Hidden"}</button>
                <button className="admin-btn admin-btn--secondary" onClick={() => openEdit(t)}>Edit</button>
                <button onClick={() => setConfirmDeleteId(t.id)} style={{ background:"none",border:"1px solid #fca5a5",color:"#dc2626",padding:"6px 14px",borderRadius:4,cursor:"pointer",fontWeight:600,fontSize:"0.8125rem" }}>Delete</button>
              </div>
              {t.rows.length > 0 && (
                <div style={{ borderTop:"1px solid #f0f0f0",padding:"10px 20px",overflowX:"auto" }}>
                  <table style={{ fontSize:"0.75rem",borderCollapse:"collapse" }}>
                    <thead><tr>{t.columns.map((c) => (<th key={c} style={{ padding:"4px 12px 4px 0",textAlign:"left",fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap" }}>{c}</th>))}</tr></thead>
                    <tbody>{t.rows.map((row, ri) => (<tr key={ri}>{t.columns.map((c) => (<td key={c} style={{ padding:"4px 12px 4px 0",color:"#333" }}>{row[c] ?? ""}</td>))}</tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingId !== null && (
        <div style={{ position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"24px 16px" }} onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}>
          <div style={{ background:"#fff",borderRadius:8,width:"100%",maxWidth:820,padding:28,boxShadow:"0 16px 48px rgba(0,0,0,0.18)" }}>
            <h2 style={{ fontWeight:800,fontSize:"1.125rem",marginBottom:24 }}>{editingId === "new" ? "Add Measurement Type" : "Edit Measurement Type"}</h2>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24 }}>
              <div className="admin-form-group">
                <label className="admin-form-label">Name *</label>
                <input className="admin-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. METRIC (CM)" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Unit Label (optional)</label>
                <input className="admin-input" value={draft.unit_label ?? ""} onChange={(e) => setDraft((d) => ({ ...d, unit_label: e.target.value }))} placeholder="e.g. cm or in" />
              </div>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontWeight:600,fontSize:"0.875rem" }}>
                <input type="checkbox" checked={draft.is_visible} onChange={(e) => setDraft((d) => ({ ...d, is_visible: e.target.checked }))} style={{ width:16,height:16 }} />
                Visible on storefront
              </label>
            </div>
            <div className="admin-form-group" style={{ marginBottom:24 }}>
              <label className="admin-form-label">Diagram Image</label>
              <div style={{ display:"flex",alignItems:"center",gap:16 }}>
                <div style={{ width:80,height:80,border:"1px solid #e5e7eb",borderRadius:6,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9fafb",flexShrink:0 }}>
                  {draft.diagram_image_url ? <Image src={draft.diagram_image_url} alt="diagram" width={80} height={80} style={{ objectFit:"cover" }} /> : <DiagramSVG />}
                </div>
                <div style={{ flex:1 }}>
                  <input type="file" accept="image/*" id="diagram-upload" style={{ display:"none" }} onChange={handleImageUpload} />
                  <label htmlFor="diagram-upload" className="admin-btn admin-btn--secondary" style={{ cursor:"pointer",display:"inline-block" }}>{uploading ? "Uploading…" : "Upload Image"}</label>
                  {draft.diagram_image_url && (<button className="admin-btn" style={{ marginLeft:8,color:"#dc2626",border:"1px solid #fca5a5",background:"none" }} onClick={() => setDraft((d) => ({ ...d, diagram_image_url: null }))}>Remove</button>)}
                  <p style={{ fontSize:"0.75rem",color:"#888",marginTop:6 }}>Leave empty to use the built-in jersey SVG diagram.</p>
                </div>
              </div>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <label className="admin-form-label" style={{ margin:0 }}>Columns</label>
                <button className="admin-btn admin-btn--secondary" style={{ padding:"4px 12px",fontSize:"0.75rem" }} onClick={addColumn}>+ Add Column</button>
              </div>
              <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
                {draft.columns.map((col, ci) => (
                  <div key={ci} style={{ display:"flex",alignItems:"center",gap:4,background:"#f3f4f6",borderRadius:4,padding:"4px 8px" }}>
                    <input value={col} onChange={(e) => renameColumn(ci, e.target.value)} style={{ border:"none",background:"transparent",fontWeight:600,fontSize:"0.8125rem",width:Math.max(60, col.length * 9) }} />
                    {ci > 0 && (<button onClick={() => removeColumn(ci)} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontWeight:700,padding:0 }}>✕</button>)}
                  </div>
                ))}
              </div>
              <p style={{ fontSize:"0.72rem",color:"#9ca3af",marginTop:6 }}>First column is usually "Size". Click a column name to rename it.</p>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <label className="admin-form-label" style={{ margin:0 }}>Rows</label>
                <button className="admin-btn admin-btn--secondary" style={{ padding:"4px 12px",fontSize:"0.75rem" }} onClick={addRow}>+ Add Row</button>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:"0.8125rem" }}>
                  <thead>
                    <tr>
                      {draft.columns.map((c) => (<th key={c} style={{ padding:"6px 8px",textAlign:"left",background:"#f9fafb",fontWeight:700,fontSize:"0.75rem",textTransform:"uppercase",letterSpacing:"0.04em",color:"#555",borderBottom:"1px solid #e5e7eb" }}>{c}</th>))}
                      <th style={{ padding:"6px 8px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",width:36 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.map((row, ri) => (
                      <tr key={ri}>
                        {draft.columns.map((c) => (<td key={c} style={{ padding:"4px 8px",borderBottom:"1px solid #f3f4f6" }}><input className="admin-input" value={row[c] ?? ""} onChange={(e) => setCell(ri, c, e.target.value)} style={{ margin:0,padding:"4px 8px",fontSize:"0.8125rem" }} placeholder={`${c}…`} /></td>))}
                        <td style={{ padding:"4px 8px",borderBottom:"1px solid #f3f4f6" }}><button onClick={() => removeRow(ri)} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontWeight:700,fontSize:"1rem" }}>✕</button></td>
                      </tr>
                    ))}
                    {draft.rows.length === 0 && (<tr><td colSpan={draft.columns.length + 1} style={{ padding:"16px 8px",textAlign:"center",color:"#9ca3af",fontSize:"0.8125rem" }}>No rows yet. Click "+ Add Row".</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ marginBottom:28 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <label className="admin-form-label" style={{ margin:0 }}>Measuring Tips (optional)</label>
                <button className="admin-btn admin-btn--secondary" style={{ padding:"4px 12px",fontSize:"0.75rem" }} onClick={addTip}>+ Add Tip</button>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {draft.measuring_tips.map((tip, ti) => (
                  <div key={ti} style={{ display:"grid",gridTemplateColumns:"140px 1fr 32px",gap:8,alignItems:"flex-start" }}>
                    <input className="admin-input" placeholder="Label (e.g. Chest)" value={tip.title} onChange={(e) => setTip(ti, "title", e.target.value)} style={{ margin:0 }} />
                    <input className="admin-input" placeholder="Tip description…" value={tip.description} onChange={(e) => setTip(ti, "description", e.target.value)} style={{ margin:0 }} />
                    <button onClick={() => removeTip(ti)} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",fontWeight:700,fontSize:"1rem",marginTop:8 }}>✕</button>
                  </div>
                ))}
                {draft.measuring_tips.length === 0 && (<p style={{ fontSize:"0.75rem",color:"#9ca3af" }}>No tips. Click "+ Add Tip" to add measuring instructions.</p>)}
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:10 }}>
              <button className="admin-btn admin-btn--secondary" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="admin-btn admin-btn--primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingId === "new" ? "Create Type" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId !== null && (
        <div style={{ position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#fff",borderRadius:8,padding:28,maxWidth:400,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,0.18)" }}>
            <h3 style={{ fontWeight:800,marginBottom:12 }}>Delete measurement type?</h3>
            <p style={{ color:"#555",fontSize:"0.9375rem",marginBottom:24 }}>This action cannot be undone.</p>
            <div style={{ display:"flex",justifyContent:"flex-end",gap:10 }}>
              <button className="admin-btn admin-btn--secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button style={{ background:"#dc2626",color:"#fff",border:"none",padding:"8px 18px",borderRadius:4,cursor:"pointer",fontWeight:700 }} onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
