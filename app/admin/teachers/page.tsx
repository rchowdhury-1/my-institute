"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { BRAND } from "@/lib/content";
import {
  Plus,
  X,
  Eye,
  EyeOff,
  Search,
  UserPlus,
  Pencil,
  KeyRound,
  UserX,
  Copy,
  Check,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  specialisation: string | null;
  bio: string | null;
  is_active: boolean;
  must_change_password: boolean;
  active_student_count: number;
}

interface CreateForm {
  display_name: string;
  email: string;
  phone: string;
  specialisation: string;
  bio: string;
  temp_password: string;
  send_email: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generatePassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

function getAxiosError(err: unknown): { status?: number; message: string } {
  const e = err as {
    response?: { status?: number; data?: { error?: string } };
  };
  return {
    status: e?.response?.status,
    message: e?.response?.data?.error ?? "Something went wrong.",
  };
}

// ─── CopyButton ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-black/5 transition-colors text-charcoal/50 hover:text-charcoal"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check size={14} className="text-emerald-primary" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminTeachersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    display_name: "",
    email: "",
    phone: "",
    specialisation: "",
    bio: "",
    temp_password: "",
    send_email: true,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Banners
  const [successBanner, setSuccessBanner] = useState<{
    name: string;
    password: string;
    email: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);
  const [resetBanner, setResetBanner] = useState<{
    teacherId: string;
    name: string;
    password: string;
    email: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);

  // Per-card state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Teacher>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────

  useEffect(() => {
    const t = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    if (!t || (role !== "admin" && role !== "supervisor")) {
      router.push("/login");
    } else {
      setToken(t);
      setAuthChecked(true);
    }
  }, [router]);

  // ── Fetch teachers ──────────────────────────────────────────────────────

  const fetchTeachers = useCallback(
    async (t: string) => {
      setLoading(true);
      try {
        const res = await api.get("/admin/teachers", {
          headers: { Authorization: `Bearer ${t}` },
        });
        setTeachers(res.data.teachers ?? res.data);
      } catch (err) {
        console.error('Fetch teachers error:', err);
        setLoadError("Failed to load teachers. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (authChecked && token) fetchTeachers(token);
  }, [authChecked, token, fetchTeachers]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const filtered = teachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.display_name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q)
    );
  });

  const totalCount = teachers.length;
  const activeCount = teachers.filter((t) => t.is_active).length;

  // ── Create ──────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      const res = await api.post(
        "/admin/teachers",
        {
          display_name: createForm.display_name,
          email: createForm.email,
          phone: createForm.phone || null,
          specialisation: createForm.specialisation || null,
          bio: createForm.bio || null,
          ...(createForm.temp_password
            ? { password: createForm.temp_password }
            : {}),
          send_email: createForm.send_email,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const tempPassword: string =
        res.data.tempPassword ?? res.data.temp_password ?? createForm.temp_password;
      // Normalise: backend RETURNING clause may omit fields we know are true for new accounts
      const newTeacher: Teacher = {
        is_active: true,
        must_change_password: true,
        active_student_count: 0,
        phone: null,
        specialisation: null,
        bio: null,
        ...(res.data.teacher ?? res.data),
      };

      setTeachers((prev) => [newTeacher, ...prev]);
      setShowCreate(false);
      setCreateForm({
        display_name: "",
        email: "",
        phone: "",
        specialisation: "",
        bio: "",
        temp_password: "",
        send_email: true,
      });
      setSuccessBanner({
        name: newTeacher.display_name,
        password: tempPassword,
        email: newTeacher.email,
        emailSent: res.data.email_sent ?? false,
        emailError: res.data.email_error || undefined,
      });
    } catch (err) {
      const { status, message } = getAxiosError(err);
      setCreateError(
        status === 409
          ? "Someone with this email address already exists."
          : message
      );
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────

  const startEdit = (teacher: Teacher) => {
    setEditingId(teacher.id);
    setEditForm({
      display_name: teacher.display_name,
      email: teacher.email,
      phone: teacher.phone ?? "",
      bio: teacher.bio ?? "",
      specialisation: teacher.specialisation ?? "",
    });
    setEditError("");
    setResetConfirmId(null);
    setDeactivateConfirmId(null);
  };

  const handleEditSave = async (teacherId: string) => {
    setEditError("");
    setEditLoading(true);
    try {
      const res = await api.patch(`/admin/teachers/${teacherId}`, editForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated: Teacher = res.data.teacher ?? res.data;
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacherId ? { ...t, ...updated } : t))
      );
      setEditingId(null);
    } catch (err) {
      const { status, message } = getAxiosError(err);
      setEditError(
        status === 409
          ? "Someone with this email address already exists."
          : message
      );
    } finally {
      setEditLoading(false);
    }
  };

  // ── Reset password ──────────────────────────────────────────────────────

  const handleResetPassword = async (teacher: Teacher) => {
    setResetLoading(true);
    try {
      const res = await api.post(
        `/admin/teachers/${teacher.id}/reset-password`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tempPassword: string =
        res.data.temp_password ?? res.data.tempPassword;
      setResetBanner({
        teacherId: teacher.id,
        name: teacher.display_name,
        password: tempPassword,
        email: teacher.email,
        emailSent: res.data.email_sent ?? false,
        emailError: res.data.email_error || undefined,
      });
      setResetConfirmId(null);
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === teacher.id ? { ...t, must_change_password: true } : t
        )
      );
    } catch (err) {
      console.error('Reset password error:', err);
      alert("Failed to reset password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  // ── Deactivate ──────────────────────────────────────────────────────────

  const handleDeactivate = async (teacher: Teacher) => {
    setDeactivateLoading(true);
    setDeactivateError(null);
    try {
      await api.patch(
        `/admin/teachers/${teacher.id}`,
        { is_active: false },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === teacher.id ? { ...t, is_active: false } : t
        )
      );
      setDeactivateConfirmId(null);
    } catch (err) {
      const { status, message } = getAxiosError(err);
      setDeactivateError({
        id: teacher.id,
        message:
          status === 409
            ? "This teacher has upcoming lessons and cannot be turned off."
            : message,
      });
    } finally {
      setDeactivateLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────

  if (!authChecked) return null;

  const inputClass =
    "w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all";

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          {loadError && (
            <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">{loadError}</div>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">
              Teachers
            </h1>
            <p className="text-charcoal/60 text-sm mt-1">
              Manage teacher accounts.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-charcoal border border-black/5">
              {totalCount} total
            </span>
            <span className="px-3 py-1 bg-emerald-primary/10 rounded-full text-xs font-medium text-emerald-primary">
              {activeCount} active
            </span>
            <button
              onClick={() => {
                setShowCreate((v) => !v);
                setCreateError("");
              }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
            >
              {showCreate ? <X size={16} /> : <Plus size={16} />}
              {showCreate ? "Cancel" : "Add Teacher"}
            </button>
          </div>
        </div>

        {/* ── Create success banner ───────────────────────────────────── */}
        {successBanner && (
          <div data-testid="success-banner" className="mb-6 p-4 bg-emerald-primary/10 border border-emerald-primary/20 rounded-2xl">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="text-sm text-charcoal">
                <p className="font-semibold text-emerald-primary mb-2">Account created for {successBanner.name}</p>
                <p className="text-charcoal/70 mb-1">Login email: <span className="font-medium text-charcoal">{successBanner.email}</span></p>
                <p className="text-charcoal/70">
                  Temporary password:{" "}
                  <span data-testid="temp-password" className="font-mono font-bold text-charcoal">{successBanner.password}</span>
                  <CopyButton text={successBanner.password} />
                </p>
              </div>
              <button data-testid="btn-dismiss-success" onClick={() => setSuccessBanner(null)} className="text-charcoal/40 hover:text-charcoal transition-colors mt-0.5">
                <X size={16} />
              </button>
            </div>
            {successBanner.emailSent ? (
              <p className="text-xs text-emerald-primary">✓ Welcome email sent</p>
            ) : (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700 font-medium">⚠ Welcome email could not be sent — please share these credentials manually.</p>
                {successBanner.emailError && <p className="text-xs text-amber-600 mt-1">Reason: {successBanner.emailError}</p>}
                <a
                  href={`https://wa.me/${BRAND.whatsapp.replace("+", "")}?text=${encodeURIComponent(`Assalamu alaikum! Your My Institute teacher account is ready.\n\nLogin: ${successBanner.email}\nPassword: ${successBanner.password}\n\nPlease log in at https://www.my-institute.com/login and set a new password.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors"
                >
                  Share via WhatsApp →
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Reset password banner ───────────────────────────────────── */}
        {resetBanner && (
          <div data-testid="reset-banner" className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="text-sm text-charcoal">
                <p className="font-semibold text-amber-700 mb-2">Password reset for {resetBanner.name}</p>
                <p className="text-charcoal/70 mb-1">Login email: <span className="font-medium text-charcoal">{resetBanner.email}</span></p>
                <p className="text-charcoal/70">
                  New temporary password:{" "}
                  <span data-testid="reset-temp-password" className="font-mono font-bold text-charcoal">{resetBanner.password}</span>
                  <CopyButton text={resetBanner.password} />
                </p>
              </div>
              <button onClick={() => setResetBanner(null)} className="text-charcoal/40 hover:text-charcoal transition-colors mt-0.5">
                <X size={16} />
              </button>
            </div>
            {resetBanner.emailSent ? (
              <p className="text-xs text-emerald-primary">✓ Password reset email sent</p>
            ) : (
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs text-red-700 font-medium">⚠ Email could not be sent — please share the new password manually.</p>
                <a
                  href={`https://wa.me/${BRAND.whatsapp.replace("+", "")}?text=${encodeURIComponent(`Your My Institute password has been reset.\n\nLogin: ${resetBanner.email}\nNew password: ${resetBanner.password}\n\nPlease log in and set a new password.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors"
                >
                  Share via WhatsApp →
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Create form ─────────────────────────────────────────────── */}
        {showCreate && (
          <div
            data-testid="create-form"
            className="mb-6 bg-white rounded-2xl border border-black/5 p-6"
          >
            <h2 className="font-semibold text-charcoal mb-5">New teacher</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Full name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    data-testid="input-display-name"
                    value={createForm.display_name}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        display_name: e.target.value,
                      }))
                    }
                    placeholder="e.g. Ustadh Ahmed Ali"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    data-testid="input-email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="teacher@example.com"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    data-testid="input-phone"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+44 7700 000000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Specialisation
                  </label>
                  <input
                    type="text"
                    data-testid="input-specialisation"
                    value={createForm.specialisation}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        specialisation: e.target.value,
                      }))
                    }
                    placeholder="e.g. Quran, Arabic Grammar"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                  Bio
                </label>
                <textarea
                  data-testid="input-bio"
                  value={createForm.bio}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="A short introduction…"
                  rows={3}
                  className={inputClass + " resize-none"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                  Temporary password
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      data-testid="input-temp-password"
                      value={createForm.temp_password}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          temp_password: e.target.value,
                        }))
                      }
                      placeholder="Leave blank to auto-generate"
                      className={inputClass + " pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal transition-colors"
                    >
                      {showCreatePassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    data-testid="btn-generate-password"
                    onClick={() => {
                      const p = generatePassword();
                      setCreateForm((f) => ({ ...f, temp_password: p }));
                      setShowCreatePassword(true);
                    }}
                    className="px-3 py-2 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors whitespace-nowrap"
                  >
                    Generate for me
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="checkbox-send-email"
                  checked={createForm.send_email}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      send_email: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30"
                />
                <span className="text-sm text-charcoal/70">
                  Send welcome email with login details
                </span>
              </label>

              {createError && (
                <p data-testid="create-error" className="text-sm text-red-600">
                  {createError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  data-testid="btn-submit-create"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
                >
                  {createLoading ? "Adding…" : "Add teacher"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateError("");
                  }}
                  className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Search ─────────────────────────────────────────────────── */}
        <div className="relative mb-6">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30"
          />
          <input
            type="text"
            data-testid="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all"
          />
        </div>

        {/* ── List / empty states ─────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
          </div>
        ) : teachers.length === 0 ? (
          <div
            data-testid="empty-no-teachers"
            className="text-center py-20"
          >
            <UserPlus
              size={40}
              className="mx-auto text-charcoal/20 mb-4"
            />
            <p className="text-charcoal/50 text-sm">
              No teachers yet. Add your first teacher above.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            data-testid="empty-no-results"
            className="text-center py-20"
          >
            <Search
              size={40}
              className="mx-auto text-charcoal/20 mb-4"
            />
            <p className="text-charcoal/50 text-sm">
              No teachers match your search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                isEditing={editingId === teacher.id}
                editForm={editForm}
                editLoading={editLoading}
                editError={editError}
                onEditStart={() => startEdit(teacher)}
                onEditFormChange={(patch) =>
                  setEditForm((f) => ({ ...f, ...patch }))
                }
                onEditSave={() => handleEditSave(teacher.id)}
                onEditCancel={() => setEditingId(null)}
                resetConfirm={resetConfirmId === teacher.id}
                resetLoading={resetLoading}
                onResetStart={() => {
                  setResetConfirmId(teacher.id);
                  setDeactivateConfirmId(null);
                  setEditingId(null);
                }}
                onResetConfirm={() => handleResetPassword(teacher)}
                onResetCancel={() => setResetConfirmId(null)}
                deactivateConfirm={deactivateConfirmId === teacher.id}
                deactivateLoading={deactivateLoading}
                deactivateError={
                  deactivateError?.id === teacher.id
                    ? deactivateError.message
                    : null
                }
                onDeactivateStart={() => {
                  setDeactivateConfirmId(teacher.id);
                  setDeactivateError(null);
                  setResetConfirmId(null);
                  setEditingId(null);
                }}
                onDeactivateConfirm={() => handleDeactivate(teacher)}
                onDeactivateCancel={() => {
                  setDeactivateConfirmId(null);
                  setDeactivateError(null);
                }}
                inputClass={inputClass}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── TeacherCard ─────────────────────────────────────────────────────────────

interface CardProps {
  teacher: Teacher;
  isEditing: boolean;
  editForm: Partial<Teacher>;
  editLoading: boolean;
  editError: string;
  onEditStart: () => void;
  onEditFormChange: (patch: Partial<Teacher>) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  resetConfirm: boolean;
  resetLoading: boolean;
  onResetStart: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
  deactivateConfirm: boolean;
  deactivateLoading: boolean;
  deactivateError: string | null;
  onDeactivateStart: () => void;
  onDeactivateConfirm: () => void;
  onDeactivateCancel: () => void;
  inputClass: string;
}

function TeacherCard({
  teacher,
  isEditing,
  editForm,
  editLoading,
  editError,
  onEditStart,
  onEditFormChange,
  onEditSave,
  onEditCancel,
  resetConfirm,
  resetLoading,
  onResetStart,
  onResetConfirm,
  onResetCancel,
  deactivateConfirm,
  deactivateLoading,
  deactivateError,
  onDeactivateStart,
  onDeactivateConfirm,
  onDeactivateCancel,
  inputClass,
}: CardProps) {
  return (
    <div
      data-testid={`teacher-card-${teacher.id}`}
      className={`bg-white rounded-2xl border p-5 transition-all ${
        teacher.is_active ? "border-black/5" : "border-black/5 opacity-70"
      }`}
    >
      {isEditing ? (
        // ── Edit mode ────────────────────────────────────────────────
        <div className="space-y-4">
          <h3 className="font-semibold text-charcoal text-sm">
            Edit teacher
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                data-testid="edit-display-name"
                value={(editForm.display_name as string) ?? ""}
                onChange={(e) =>
                  onEditFormChange({ display_name: e.target.value })
                }
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                Email
              </label>
              <input
                type="email"
                data-testid="edit-email"
                value={(editForm.email as string) ?? ""}
                onChange={(e) => onEditFormChange({ email: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                data-testid="edit-phone"
                value={(editForm.phone as string) ?? ""}
                onChange={(e) => onEditFormChange({ phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                Specialisation
              </label>
              <input
                type="text"
                data-testid="edit-specialisation"
                value={(editForm.specialisation as string) ?? ""}
                onChange={(e) =>
                  onEditFormChange({ specialisation: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
              Bio
            </label>
            <textarea
              data-testid="edit-bio"
              value={(editForm.bio as string) ?? ""}
              onChange={(e) => onEditFormChange({ bio: e.target.value })}
              rows={3}
              className={inputClass + " resize-none"}
            />
          </div>
          {editError && (
            <p data-testid="edit-error" className="text-sm text-red-600">
              {editError}
            </p>
          )}
          <div className="flex gap-3">
            <button
              data-testid="btn-edit-save"
              onClick={onEditSave}
              disabled={editLoading}
              className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
            >
              {editLoading ? "Saving…" : "Save"}
            </button>
            <button
              data-testid="btn-edit-cancel"
              onClick={onEditCancel}
              className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // ── View mode ────────────────────────────────────────────────
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="font-semibold text-charcoal">
                  {teacher.display_name}
                </h3>
                {teacher.is_active ? (
                  <span
                    data-testid="badge-active"
                    className="px-2 py-0.5 rounded-full bg-emerald-primary/10 text-emerald-primary text-xs font-medium"
                  >
                    Active
                  </span>
                ) : (
                  <span
                    data-testid="badge-turned-off"
                    className="px-2 py-0.5 rounded-full bg-charcoal/10 text-charcoal/50 text-xs font-medium"
                  >
                    Turned off
                  </span>
                )}
                {teacher.must_change_password && (
                  <span
                    data-testid="badge-awaiting-login"
                    className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium"
                  >
                    Awaiting first login
                  </span>
                )}
              </div>
              <p className="text-sm text-charcoal/60">{teacher.email}</p>
              {teacher.phone && (
                <p className="text-sm text-charcoal/50 mt-0.5">
                  {teacher.phone}
                </p>
              )}
              {teacher.specialisation && (
                <p className="text-xs text-charcoal/40 mt-1">
                  {teacher.specialisation}
                </p>
              )}
            </div>

            {teacher.is_active && (
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <button
                  data-testid="btn-edit"
                  onClick={onEditStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                >
                  <Pencil size={13} />
                  Edit
                </button>
                <button
                  data-testid="btn-reset-password"
                  onClick={onResetStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                >
                  <KeyRound size={13} />
                  Reset password
                </button>
                <button
                  data-testid="btn-deactivate"
                  onClick={onDeactivateStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors"
                >
                  <UserX size={13} />
                  Turn off access
                </button>
              </div>
            )}
          </div>

          {/* Reset password confirm panel */}
          {resetConfirm && (
            <div
              data-testid="reset-confirm-panel"
              className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl"
            >
              <p className="text-sm text-charcoal mb-3">
                Reset {teacher.display_name}&apos;s password? They will receive
                a new temporary password and must change it on next login.
              </p>
              <div className="flex gap-2">
                <button
                  data-testid="btn-reset-confirm"
                  onClick={onResetConfirm}
                  disabled={resetLoading}
                  className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors"
                >
                  {resetLoading ? "Resetting…" : "Yes, reset password"}
                </button>
                <button
                  data-testid="btn-reset-cancel"
                  onClick={onResetCancel}
                  className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Deactivate confirm panel */}
          {deactivateConfirm && (
            <div
              data-testid="deactivate-confirm-panel"
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl"
            >
              <p className="text-sm text-charcoal mb-3">
                Turn off {teacher.display_name}&apos;s access? They will no
                longer be able to log in.
              </p>
              {deactivateError && (
                <p
                  data-testid="deactivate-error"
                  className="text-xs text-red-600 mb-2"
                >
                  {deactivateError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  data-testid="btn-deactivate-confirm"
                  onClick={onDeactivateConfirm}
                  disabled={deactivateLoading}
                  className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  {deactivateLoading ? "Turning off…" : "Yes, turn off"}
                </button>
                <button
                  data-testid="btn-deactivate-cancel"
                  onClick={onDeactivateCancel}
                  className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
