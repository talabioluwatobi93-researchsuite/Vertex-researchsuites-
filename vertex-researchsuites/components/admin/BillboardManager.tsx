"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#777777";
const BORDER = "#EEEEEE";
const BG = "#F9F9F9";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Slide = {
  id: string;
  title: string;
  text: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

type DraftSlide = {
  title: string;
  text: string;
  icon: string;
  image_url: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_DRAFT: DraftSlide = {
  title: "",
  text: "",
  icon: "",
  image_url: "",
  sort_order: "0",
  is_active: true,
};

export default function BillboardManager() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftSlide>(EMPTY_DRAFT);
  const [newDraft, setNewDraft] = useState<DraftSlide>(EMPTY_DRAFT);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadSlides() {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("billboard_slides")
      .select("id, title, text, icon, image_url, sort_order, is_active")
      .order("sort_order", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setSlides([]);
    } else {
      setSlides(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSlides();
  }, []);

  function startEdit(slide: Slide) {
    setEditingId(slide.id);
    setEditDraft({
      title: slide.title,
      text: slide.text ?? "",
      icon: slide.icon ?? "",
      image_url: slide.image_url ?? "",
      sort_order: String(slide.sort_order),
      is_active: slide.is_active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  async function saveEdit(id: string) {
    setSavingId(id);
    setErrorMsg(null);
    const { error } = await supabase
      .from("billboard_slides")
      .update({
        title: editDraft.title.trim(),
        text: editDraft.text.trim() || null,
        icon: editDraft.icon.trim() || null,
        image_url: editDraft.image_url.trim() || null,
        sort_order: Number(editDraft.sort_order) || 0,
        is_active: editDraft.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setSavingId(null);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setEditingId(null);
    await loadSlides();
  }

  async function deleteSlide(id: string) {
    const confirmed = window.confirm("Delete this slide? This cannot be undone.");
    if (!confirmed) return;

    setSavingId(id);
    setErrorMsg(null);
    const { error } = await supabase.from("billboard_slides").delete().eq("id", id);
    setSavingId(null);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await loadSlides();
  }

  async function toggleActive(slide: Slide) {
    setSavingId(slide.id);
    setErrorMsg(null);
    const { error } = await supabase
      .from("billboard_slides")
      .update({ is_active: !slide.is_active, updated_at: new Date().toISOString() })
      .eq("id", slide.id);
    setSavingId(null);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    await loadSlides();
  }

  async function addSlide() {
    if (!newDraft.title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }
    setSavingId("new");
    setErrorMsg(null);
    const { error } = await supabase.from("billboard_slides").insert({
      title: newDraft.title.trim(),
      text: newDraft.text.trim() || null,
      icon: newDraft.icon.trim() || null,
      image_url: newDraft.image_url.trim() || null,
      sort_order: Number(newDraft.sort_order) || 0,
      is_active: newDraft.is_active,
    });
    setSavingId(null);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setNewDraft(EMPTY_DRAFT);
    setShowAddForm(false);
    await loadSlides();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    fontSize: 13,
    color: DARK,
    background: "#FFFFFF",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: MUTED,
    fontWeight: 600,
    marginBottom: 4,
    display: "block",
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: DARK, margin: 0 }}>
          Billboard Slides
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            background: GOLD,
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showAddForm ? "Cancel" : "+ Add Slide"}
        </button>
      </div>

      {errorMsg && (
        <div
          style={{
            background: "#FDECEC",
            color: "#B3261E",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {errorMsg}
        </div>
      )}

      {showAddForm && (
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input style={inputStyle} value={newDraft.title} onChange={(e) => setNewDraft({ ...newDraft, title: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Icon / Emoji (fallback if no image)</label>
              <input style={inputStyle} value={newDraft.icon} onChange={(e) => setNewDraft({ ...newDraft, icon: e.target.value })} placeholder="🚀" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Body text</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={newDraft.text} onChange={(e) => setNewDraft({ ...newDraft, text: e.target.value })} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Image URL (Supabase Storage) — overrides icon/text layout</label>
            <input style={inputStyle} value={newDraft.image_url} onChange={(e) => setNewDraft({ ...newDraft, image_url: e.target.value })} placeholder="https://..." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Sort order</label>
              <input style={inputStyle} type="number" value={newDraft.sort_order} onChange={(e) => setNewDraft({ ...newDraft, sort_order: e.target.value })} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 8 }}>
              <input type="checkbox" checked={newDraft.is_active} onChange={(e) => setNewDraft({ ...newDraft, is_active: e.target.checked })} />
              <span style={{ fontSize: 13, color: DARK }}>Active</span>
            </div>
          </div>
          <button
            onClick={addSlide}
            disabled={savingId === "new"}
            style={{
              background: GOLD,
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: savingId === "new" ? "default" : "pointer",
              opacity: savingId === "new" ? 0.6 : 1,
            }}
          >
            {savingId === "new" ? "Saving..." : "Save Slide"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: MUTED, fontSize: 13 }}>Loading slides...</div>
      ) : slides.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13 }}>No slides yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {slides.map((slide) => (
            <div key={slide.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
              {editingId === slide.id ? (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Title *</label>
                      <input style={inputStyle} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Icon / Emoji</label>
                      <input style={inputStyle} value={editDraft.icon} onChange={(e) => setEditDraft({ ...editDraft, icon: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Body text</label>
                    <textarea style={{ ...inputStyle, minHeight: 60 }} value={editDraft.text} onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Image URL</label>
                    <input style={inputStyle} value={editDraft.image_url} onChange={(e) => setEditDraft({ ...editDraft, image_url: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Sort order</label>
                      <input style={inputStyle} type="number" value={editDraft.sort_order} onChange={(e) => setEditDraft({ ...editDraft, sort_order: e.target.value })} />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 8 }}>
                      <input type="checkbox" checked={editDraft.is_active} onChange={(e) => setEditDraft({ ...editDraft, is_active: e.target.checked })} />
                      <span style={{ fontSize: 13, color: DARK }}>Active</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => saveEdit(slide.id)}
                      disabled={savingId === slide.id}
                      style={{ background: GOLD, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {savingId === slide.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{ background: "#FFFFFF", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <SlideRow
                  slide={slide}
                  saving={savingId === slide.id}
                  onEdit={() => startEdit(slide)}
                  onDelete={() => deleteSlide(slide.id)}
                  onToggleActive={() => toggleActive(slide)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideRow({
  slide,
  saving,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  slide: Slide;
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: slide.is_active ? "#2E7D32" : "#BDBDBD",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{slide.title}</span>
          <span style={{ fontSize: 11, color: MUTED }}>order: {slide.sort_order}</span>
        </div>
        {slide.text && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>{slide.text}</div>}
        {slide.image_url ? (
          <div style={{ fontSize: 11, color: MUTED }}>Image slide: {slide.image_url}</div>
        ) : (
          <div style={{ fontSize: 11, color: MUTED }}>Icon: {slide.icon ?? "(none)"}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={onEdit}
          style={{ background: "#FFFFFF", color: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
        >
          Edit
        </button>
        <button
          onClick={onToggleActive}
          disabled={saving}
          style={{ background: "#FFFFFF", color: DARK, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
        >
          {slide.is_active ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={onDelete}
          disabled={saving}
          style={{ background: "#FFFFFF", color: "#B3261E", border: "1px solid #F3C5C1", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
