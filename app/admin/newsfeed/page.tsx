"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { getAxiosError } from "@/lib/errors";
import { INPUT_CLASS as inputClass } from "@/lib/styles";
import { Plus, X, Pencil, Trash2, Eye, Image as ImageIcon } from "lucide-react";
import ImageUploadField from "@/components/admin/ImageUploadField";

interface Post {
  id: string;
  type: "quote" | "honour_list" | "general";
  title: string;
  body: string;
  image_url: string | null;
  show_on_homepage: boolean;
  published_at: string;
}

const TYPE_OPTIONS = [
  { value: "quote", label: "Quote of the Month" },
  { value: "honour_list", label: "Honour List" },
  { value: "general", label: "General Update" },
] as const;

const TYPE_BADGE: Record<string, string> = {
  quote: "bg-purple-100 text-purple-700",
  honour_list: "bg-gold/15 text-gold-dark",
  general: "bg-emerald-primary/10 text-emerald-primary",
};

const TYPE_LABEL: Record<string, string> = {
  quote: "Quote",
  honour_list: "Honour List",
  general: "Update",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminNewsfeedPage() {
  const { authChecked } = useAuthGuard(["admin", "supervisor"]);
  const [token, setToken] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "general" as Post["type"],
    title: "",
    body: "",
    image_url: "",
    show_on_homepage: false,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    type: "general" as Post["type"],
    title: "",
    body: "",
    image_url: "",
    show_on_homepage: false,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authChecked) setToken(localStorage.getItem("accessToken"));
  }, [authChecked]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/newsfeed");
      setPosts(res.data.posts ?? []);
    } catch (err) {
      console.error('Fetch posts error:', err);
      setLoadError("Failed to load posts. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && token) fetchPosts();
  }, [authChecked, token, fetchPosts]);

  // Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await api.post(
        "/admin/newsfeed",
        {
          type: createForm.type,
          title: createForm.title,
          body: createForm.body,
          image_url: createForm.image_url || null,
          show_on_homepage: createForm.show_on_homepage,
        }
      );
      setPosts((prev) => [res.data.post, ...prev]);
      setShowCreate(false);
      setCreateForm({ type: "general", title: "", body: "", image_url: "", show_on_homepage: false });
    } catch (err) {
      setCreateError(getAxiosError(err).message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Edit
  const startEdit = (post: Post) => {
    setEditingId(post.id);
    setEditForm({
      type: post.type,
      title: post.title,
      body: post.body,
      image_url: post.image_url ?? "",
      show_on_homepage: post.show_on_homepage,
    });
    setEditError("");
    setDeleteConfirmId(null);
  };

  const handleEditSave = async (postId: string) => {
    setEditError("");
    setEditLoading(true);
    try {
      const res = await api.patch(
        `/admin/newsfeed/${postId}`,
        {
          type: editForm.type,
          title: editForm.title,
          body: editForm.body,
          image_url: editForm.image_url || null,
          show_on_homepage: editForm.show_on_homepage,
        }
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? res.data.post : p))
      );
      setEditingId(null);
    } catch (err) {
      setEditError(getAxiosError(err).message);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete
  const handleDelete = async (postId: string) => {
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/newsfeed/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Delete post error:', err);
      alert(getAxiosError(err).message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!authChecked) return null;

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {loadError && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">{loadError}</div>
        )}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">
              Community
            </h1>
            <p className="text-charcoal/60 text-sm mt-1">
              Post quotes, honour list updates, and announcements.
            </p>
          </div>
          <button
            onClick={() => { setShowCreate((v) => !v); setCreateError(""); }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
          >
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? "Cancel" : "Add Post"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div data-testid="create-form" className="mb-6 bg-white rounded-2xl border border-black/5 p-6">
            <h2 className="font-semibold text-charcoal mb-5">New post</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as Post["type"] }))}
                  className={inputClass}
                  data-testid="input-type"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Post title"
                  required
                  className={inputClass}
                  data-testid="input-title"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={createForm.body}
                  onChange={(e) => setCreateForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Post content…"
                  rows={5}
                  required
                  className={inputClass + " resize-none"}
                  data-testid="input-body"
                />
              </div>

              <ImageUploadField
                label="Image"
                value={createForm.image_url}
                onChange={(url) => setCreateForm((f) => ({ ...f, image_url: url }))}
              />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createForm.show_on_homepage}
                  onChange={(e) => setCreateForm((f) => ({ ...f, show_on_homepage: e.target.checked }))}
                  className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30"
                  data-testid="input-homepage"
                />
                <span className="text-sm text-charcoal/70">Show on homepage</span>
              </label>

              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createLoading}
                  data-testid="btn-submit-create"
                  className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                >
                  {createLoading ? "Publishing…" : "Publish post"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Posts list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon size={40} className="mx-auto text-charcoal/20 mb-4" />
            <p className="text-charcoal/50 text-sm">No posts yet. Create your first one above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                data-testid={`post-card-${post.id}`}
                className="bg-white rounded-2xl border border-black/5 overflow-hidden"
              >
                {editingId === post.id ? (
                  /* Edit mode */
                  <div className="p-5 space-y-4">
                    <h3 className="font-semibold text-charcoal text-sm">Edit post</h3>
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as Post["type"] }))}
                      className={inputClass}
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className={inputClass}
                      data-testid="edit-title"
                    />
                    <textarea
                      value={editForm.body}
                      onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                      rows={5}
                      className={inputClass + " resize-none"}
                      data-testid="edit-body"
                    />
                    <ImageUploadField
                      label="Image"
                      value={editForm.image_url}
                      onChange={(url) => setEditForm((f) => ({ ...f, image_url: url }))}
                    />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editForm.show_on_homepage}
                        onChange={(e) => setEditForm((f) => ({ ...f, show_on_homepage: e.target.checked }))}
                        className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30"
                        data-testid="edit-homepage"
                      />
                      <span className="text-sm text-charcoal/70">Show on homepage</span>
                    </label>
                    {editError && <p className="text-sm text-red-600">{editError}</p>}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEditSave(post.id)}
                        disabled={editLoading}
                        data-testid="btn-edit-save"
                        className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                      >
                        {editLoading ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3 min-w-0">
                        {post.image_url && (
                          <div className="w-14 h-14 rounded-lg border border-black/10 overflow-hidden bg-cream shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[post.type]}`}>
                              {TYPE_LABEL[post.type]}
                            </span>
                            {post.show_on_homepage && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 flex items-center gap-1">
                                <Eye size={10} /> Homepage
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-charcoal text-sm">{post.title}</h3>
                          <p className="text-charcoal/50 text-xs mt-0.5 line-clamp-2">
                            {post.body.length > 150 ? post.body.slice(0, 150) + "…" : post.body}
                          </p>
                          <p className="text-charcoal/30 text-xs mt-1.5">
                            {formatDate(post.published_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(post)}
                          data-testid="btn-edit"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        {deleteConfirmId === post.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDelete(post.id)}
                              disabled={deleteLoading}
                              data-testid="btn-delete-confirm"
                              className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                            >
                              Yes, delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setDeleteConfirmId(post.id); setEditingId(null); }}
                            data-testid="btn-delete"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
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
