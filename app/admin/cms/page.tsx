"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Plus, Trash2, Edit2, Check, X, ChevronUp, ChevronDown } from "lucide-react";

interface CmsItem {
  id: string;
  section_type: string;
  title?: string;
  content?: string;
  image_url?: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

const SECTION_TYPES = [
  { key: "advertisements", label: "Advertisements" },
  { key: "islam_info", label: "Learn About Islam" },
  { key: "honor_list", label: "Honor List" },
  { key: "quotes", label: "Quotes" },
] as const;

type SectionKey = typeof SECTION_TYPES[number]["key"];

const emptyForm = { title: "", content: "", image_url: "", position: "0" };

export default function AdminCmsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SectionKey>("advertisements");
  const [items, setItems] = useState<Record<SectionKey, CmsItem[]>>({
    advertisements: [], islam_info: [], honor_list: [], quotes: [],
  });
  const [loading, setLoading] = useState<Record<SectionKey, boolean>>({
    advertisements: true, islam_info: false, honor_list: false, quotes: false,
  });
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    if (!token || (role !== "admin" && role !== "supervisor")) { router.push("/login"); return; }
    fetchSection("advertisements");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetchSection(type: SectionKey) {
    if (!loading[type] && items[type].length > 0) return; // already loaded
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await api.get(`/cms/admin/${type}`, { headers: authHeaders() });
      setItems(prev => ({ ...prev, [type]: res.data.items }));
    } catch {
      // ignore
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  }

  function switchTab(type: SectionKey) {
    setActiveTab(type);
    setEditingId(null);
    fetchSection(type);
  }

  async function handleAdd() {
    if (!form.title && !form.content) return;
    setAdding(true);
    try {
      const res = await api.post("/cms", {
        section_type: activeTab,
        title: form.title || undefined,
        content: form.content || undefined,
        image_url: form.image_url || undefined,
        position: parseInt(form.position) || 0,
      }, { headers: authHeaders() });
      setItems(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], res.data.item].sort((a, b) => a.position - b.position),
      }));
      setForm(emptyForm);
    } catch {
      alert("Failed to add item.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: CmsItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title ?? "",
      content: item.content ?? "",
      image_url: item.image_url ?? "",
      position: String(item.position),
    });
  }

  async function handleSave(item: CmsItem) {
    setSaving(item.id);
    try {
      const res = await api.patch(`/cms/${item.id}`, {
        title: editForm.title || null,
        content: editForm.content || null,
        image_url: editForm.image_url || null,
        position: parseInt(editForm.position) || 0,
      }, { headers: authHeaders() });
      setItems(prev => ({
        ...prev,
        [activeTab]: prev[activeTab]
          .map(i => i.id === item.id ? res.data.item : i)
          .sort((a, b) => a.position - b.position),
      }));
      setEditingId(null);
    } catch {
      alert("Failed to save.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(item: CmsItem) {
    try {
      const res = await api.patch(`/cms/${item.id}`, { is_active: !item.is_active }, { headers: authHeaders() });
      setItems(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(i => i.id === item.id ? res.data.item : i),
      }));
    } catch {
      alert("Failed to toggle.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    setDeleting(id);
    try {
      await api.delete(`/cms/${id}`, { headers: authHeaders() });
      setItems(prev => ({ ...prev, [activeTab]: prev[activeTab].filter(i => i.id !== id) }));
    } catch {
      alert("Failed to delete.");
    } finally {
      setDeleting(null);
    }
  }

  async function moveItem(item: CmsItem, direction: "up" | "down") {
    const list = items[activeTab];
    const idx = list.findIndex(i => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    const newPos = other.position;
    const otherPos = item.position;
    try {
      await Promise.all([
        api.patch(`/cms/${item.id}`, { position: newPos }, { headers: authHeaders() }),
        api.patch(`/cms/${other.id}`, { position: otherPos }, { headers: authHeaders() }),
      ]);
      setItems(prev => ({
        ...prev,
        [activeTab]: prev[activeTab]
          .map(i => {
            if (i.id === item.id) return { ...i, position: newPos };
            if (i.id === other.id) return { ...i, position: otherPos };
            return i;
          })
          .sort((a, b) => a.position - b.position),
      }));
    } catch {
      alert("Failed to reorder.");
    }
  }

  const currentItems = items[activeTab];
  const isLoading = loading[activeTab];

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-charcoal mb-2">CMS Sections</h1>
        <p className="text-charcoal/50 text-sm mb-8">Manage homepage dynamic content sections</p>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-full p-1 border border-black/5 mb-8 w-fit flex-wrap">
          {SECTION_TYPES.map(({ key, label }) => (
            <button key={key} onClick={() => switchTab(key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === key ? "bg-emerald-primary text-white" : "text-charcoal/60 hover:text-charcoal"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Add form */}
        <div className="bg-white rounded-2xl border border-black/5 p-5 mb-6">
          <h2 className="font-semibold text-charcoal text-sm mb-3">Add New Item</h2>
          <div className="space-y-2">
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Title"
              className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Content / text" rows={3}
              className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="url" value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                placeholder="Image URL (optional)"
                className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
              <input type="number" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                placeholder="Position (0 = first)"
                className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
            </div>
            <button onClick={handleAdd} disabled={adding || (!form.title && !form.content)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
              <Plus size={14} /> {adding ? "Adding…" : "Add Item"}
            </button>
          </div>
        </div>

        {/* Items list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
          </div>
        ) : currentItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30 text-sm">
            No items in this section yet.
          </div>
        ) : (
          <div className="space-y-2">
            {currentItems.map((item, idx) => (
              <div key={item.id} className={`bg-white rounded-2xl border p-5 transition-all ${item.is_active ? "border-black/5" : "border-black/5 opacity-60"}`}>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Title"
                      className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                    <textarea value={editForm.content} onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))}
                      placeholder="Content" rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="url" value={editForm.image_url} onChange={e => setEditForm(p => ({ ...p, image_url: e.target.value }))}
                        placeholder="Image URL"
                        className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                      <input type="number" value={editForm.position} onChange={e => setEditForm(p => ({ ...p, position: e.target.value }))}
                        placeholder="Position"
                        className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSave(item)} disabled={saving === item.id}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-primary text-white text-xs font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                        <Check size={12} /> {saving === item.id ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {item.title && <p className="font-semibold text-charcoal text-sm">{item.title}</p>}
                      {item.content && <p className="text-xs text-charcoal/50 mt-0.5 leading-relaxed line-clamp-2">{item.content}</p>}
                      {item.image_url && <p className="text-xs text-emerald-primary mt-0.5 truncate">Image attached</p>}
                      <p className="text-[10px] text-charcoal/30 mt-1">Position: {item.position}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Reorder */}
                      <button onClick={() => moveItem(item, "up")} disabled={idx === 0}
                        className="p-1.5 rounded-lg text-charcoal/30 hover:text-charcoal hover:bg-cream disabled:opacity-20 transition-colors">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => moveItem(item, "down")} disabled={idx === currentItems.length - 1}
                        className="p-1.5 rounded-lg text-charcoal/30 hover:text-charcoal hover:bg-cream disabled:opacity-20 transition-colors">
                        <ChevronDown size={14} />
                      </button>
                      {/* Toggle active */}
                      <button onClick={() => toggleActive(item)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${item.is_active ? "bg-emerald-primary/10 text-emerald-primary hover:bg-emerald-primary/20" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                        {item.is_active ? "Active" : "Inactive"}
                      </button>
                      <button onClick={() => startEdit(item)}
                        className="p-1.5 rounded-lg text-charcoal/30 hover:text-emerald-primary hover:bg-emerald-primary/10 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                        className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
