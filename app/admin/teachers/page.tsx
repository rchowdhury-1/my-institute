"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { getAxiosError } from "@/lib/errors";
import { INPUT_CLASS as inputClass } from "@/lib/styles";
import { generatePassword } from "@/lib/adminUtils";
import { usePersonAdmin } from "@/lib/usePersonAdmin";
import CredentialBanner from "@/components/admin/CredentialBanner";
import PersonCard from "@/components/admin/PersonCard";
import {
  Plus,
  X,
  Eye,
  EyeOff,
  Search,
  UserPlus,
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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminTeachersPage() {
  const { authChecked } = useAuthGuard(["admin", "supervisor"]);
  const [token, setToken] = useState<string | null>(null);

  const admin = usePersonAdmin<Teacher>("teacher", {
    buildEditForm: (teacher) => ({
      display_name: teacher.display_name,
      email: teacher.email,
      phone: teacher.phone ?? "",
      bio: teacher.bio ?? "",
      specialisation: teacher.specialisation ?? "",
    }),
  });
  const {
    items: teachers,
    setItems: setTeachers,
    loading,
    loadError,
    fetchItems: fetchTeachers,
    editingId,
    editForm,
    editLoading,
    editError,
    startEdit,
    updateEditForm,
    handleEditSave,
    cancelEdit,
    resetBanner,
    setResetBanner,
    accountActionFor,
    startAction,
    confirmAction,
    cancelAction,
  } = admin;

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

  // ── Auth guard ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (authChecked) setToken(localStorage.getItem("accessToken"));
  }, [authChecked]);

  // ── Fetch teachers ──────────────────────────────────────────────────────

  useEffect(() => {
    if (authChecked && token) fetchTeachers();
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
        }
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

  // ────────────────────────────────────────────────────────────────────────

  if (!authChecked) return null;

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
          <CredentialBanner
            variant="create"
            role="teacher"
            name={successBanner.name}
            email={successBanner.email}
            password={successBanner.password}
            emailSent={successBanner.emailSent}
            emailError={successBanner.emailError}
            onDismiss={() => setSuccessBanner(null)}
          />
        )}

        {/* ── Reset password banner ───────────────────────────────────── */}
        {resetBanner && (
          <CredentialBanner
            variant="reset"
            role="teacher"
            name={resetBanner.name}
            email={resetBanner.email}
            password={resetBanner.password}
            emailSent={resetBanner.emailSent}
            emailError={resetBanner.emailError}
            onDismiss={() => setResetBanner(null)}
          />
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
              <PersonCard
                key={teacher.id}
                role="teacher"
                person={teacher}
                isEditing={editingId === teacher.id}
                editForm={editForm}
                editLoading={editLoading}
                editError={editError}
                onEditStart={() => startEdit(teacher)}
                onEditFormChange={(patch) => updateEditForm(patch)}
                onEditSave={() => handleEditSave(teacher.id)}
                onEditCancel={() => cancelEdit()}
                accountAction={accountActionFor(teacher)}
                onActionStart={(type) => startAction(type, teacher.id)}
                onActionConfirm={() => {
                  const action = accountActionFor(teacher);
                  if (action) confirmAction(action.type, teacher);
                }}
                onActionCancel={() => {
                  const action = accountActionFor(teacher);
                  if (action) cancelAction(action.type);
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
