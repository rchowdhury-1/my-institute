"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { getAxiosError } from "@/lib/errors";
import { INPUT_CLASS as inputClass } from "@/lib/styles";
import { generatePassword } from "@/lib/adminUtils";
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface Teacher {
  id: string;
  display_name: string;
  is_active: boolean;
}

interface Student {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  guardian_name: string | null;
  teacher_id: string | null;
  hourly_rate: string | null;   // comes as string from Postgres DECIMAL
  currency: string;
  is_legacy_pricing: boolean;
  pricing_notes: string | null;
  is_active: boolean;
  must_change_password: boolean;
  // bundle (may be null if no package assigned)
  package_id: string | null;
  package_name: string | null;
  total_lessons: number | null;
  used_lessons: number | null;
  sessions_remaining: number | null;
  expires_at: string | null;
}

interface CreateForm {
  display_name: string;
  email: string;
  phone: string;
  guardian_name: string;
  teacher_id: string;
  hourly_rate: string;
  currency: "GBP" | "EGP";
  is_legacy_pricing: boolean;
  pricing_notes: string;
  // bundle (all-or-nothing)
  package_name: string;
  total_lessons: string;
  expires_at: string;
  // auth
  temp_password: string;
  send_email: boolean;
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminStudentsPage() {
  const { authChecked } = useAuthGuard(["admin", "supervisor"]);
  const [token, setToken] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    display_name: "",
    email: "",
    phone: "",
    guardian_name: "",
    teacher_id: "",
    hourly_rate: "",
    currency: "GBP",
    is_legacy_pricing: false,
    pricing_notes: "",
    package_name: "",
    total_lessons: "",
    expires_at: "",
    temp_password: "",
    send_email: true,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Banners
  const [successBanner, setSuccessBanner] = useState<{ name: string; password: string; email: string; emailSent: boolean; emailError?: string } | null>(null);
  const [resetBanner, setResetBanner] = useState<{ studentId: string; name: string; password: string; email: string; emailSent: boolean; emailError?: string } | null>(null);

  // Per-card state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<{ id: string; message: string } | null>(null);

  const [reactivateConfirmId, setReactivateConfirmId] = useState<string | null>(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authChecked) setToken(localStorage.getItem("accessToken"));
  }, [authChecked]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/students");
      setStudents(res.data.students ?? res.data);
    } catch (err) {
      console.error('Fetch students error:', err);
      setError("Failed to load students. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await api.get("/admin/teachers");
      const all: Teacher[] = res.data.teachers ?? res.data;
      setTeachers(all.filter((t) => t.is_active));
    } catch (err) {
      // non-critical — dropdown just stays empty
      console.error("[admin/students] failed to load teachers:", err);
    }
  }, []);

  useEffect(() => {
    if (authChecked && token) {
      fetchStudents();
      fetchTeachers();
    }
  }, [authChecked, token, fetchStudents, fetchTeachers]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = students.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.display_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  const totalCount = students.length;
  const activeCount = students.filter((s) => s.is_active).length;

  // ── Create ────────────────────────────────────────────────────────────────

  const resetCreateForm = () =>
    setCreateForm({
      display_name: "",
      email: "",
      phone: "",
      guardian_name: "",
      teacher_id: "",
      hourly_rate: "",
      currency: "GBP",
      is_legacy_pricing: false,
      pricing_notes: "",
      package_name: "",
      total_lessons: "",
      expires_at: "",
      temp_password: "",
      send_email: true,
    });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    // Client-side: hourly rate required and must be positive
    const rateNum = parseFloat(createForm.hourly_rate);
    if (!createForm.hourly_rate || isNaN(rateNum) || rateNum <= 0) {
      setCreateError("Hourly rate is required and must be a positive number.");
      return;
    }

    // Client-side: bundle is all-or-nothing
    const bundleFilled = [createForm.package_name, createForm.total_lessons, createForm.expires_at].filter(Boolean).length;
    if (bundleFilled > 0 && bundleFilled < 3) {
      setCreateError("To add a prepaid bundle, fill in all three fields: bundle label, total lessons, and expiry date.");
      return;
    }

    setCreateLoading(true);

    try {
      const res = await api.post(
        "/admin/students",
        {
          display_name: createForm.display_name,
          email: createForm.email,
          phone: createForm.phone || null,
          guardian_name: createForm.guardian_name || null,
          teacher_id: createForm.teacher_id || null,
          hourly_rate: createForm.hourly_rate,
          currency: createForm.currency,
          is_legacy_pricing: createForm.is_legacy_pricing,
          pricing_notes: createForm.pricing_notes || null,
          ...(createForm.package_name && createForm.total_lessons && createForm.expires_at
            ? {
                package_name: createForm.package_name,
                total_lessons: parseInt(createForm.total_lessons),
                expires_at: createForm.expires_at,
              }
            : {}),
          ...(createForm.temp_password ? { password: createForm.temp_password } : {}),
          send_email: createForm.send_email,
        }
      );

      const tempPassword: string = res.data.tempPassword ?? res.data.temp_password;
      const newName: string = res.data.student?.display_name ?? createForm.display_name;

      // Re-fetch the full list so the new card has all fields (package, rate, etc.)
      await fetchStudents();

      setShowCreate(false);
      resetCreateForm();
      setSuccessBanner({
        name: newName,
        password: tempPassword,
        email: createForm.email,
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

  // ── Edit ──────────────────────────────────────────────────────────────────

  const startEdit = (student: Student) => {
    setEditingId(student.id);
    setEditForm({
      display_name: student.display_name,
      email: student.email,
      phone: student.phone ?? "",
      guardian_name: student.guardian_name ?? "",
      teacher_id: student.teacher_id ?? "",
      hourly_rate: student.hourly_rate ?? "",
      currency: student.currency as Student["currency"],
      is_legacy_pricing: student.is_legacy_pricing,
      pricing_notes: student.pricing_notes ?? "",
    });
    setEditError("");
    setResetConfirmId(null);
    setDeactivateConfirmId(null);
  };

  const handleEditSave = async (studentId: string) => {
    setEditError("");
    setEditLoading(true);
    try {
      const res = await api.patch(
        `/admin/students/${studentId}`,
        {
          display_name: editForm.display_name,
          email: editForm.email,
          phone: (editForm.phone as string) || null,
          guardian_name: (editForm.guardian_name as string) || null,
          teacher_id: (editForm.teacher_id as string) || null,
          hourly_rate: editForm.hourly_rate,
          currency: editForm.currency,
          is_legacy_pricing: editForm.is_legacy_pricing,
          pricing_notes: (editForm.pricing_notes as string) || null,
        }
      );
      const updated: Partial<Student> = res.data.student ?? res.data;
      // Merge — PATCH response doesn't include package fields, keep existing ones
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ...updated } : s))
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

  // ── Reset password ────────────────────────────────────────────────────────

  const handleResetPassword = async (student: Student) => {
    setResetLoading(true);
    try {
      const res = await api.post(
        `/admin/students/${student.id}/reset-password`,
        {}
      );
      const tempPassword: string = res.data.tempPassword ?? res.data.temp_password;
      setResetBanner({
        studentId: student.id,
        name: student.display_name,
        password: tempPassword,
        email: student.email,
        emailSent: res.data.email_sent ?? false,
        emailError: res.data.email_error || undefined,
      });
      setResetConfirmId(null);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id ? { ...s, must_change_password: true } : s
        )
      );
    } catch (err) {
      console.error('Reset password error:', err);
      alert(getAxiosError(err).message);
    } finally {
      setResetLoading(false);
    }
  };

  // ── Deactivate ────────────────────────────────────────────────────────────

  const handleDeactivate = async (student: Student) => {
    setDeactivateLoading(true);
    setDeactivateError(null);
    try {
      await api.patch(
        `/admin/students/${student.id}`,
        { is_active: false }
      );
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_active: false } : s))
      );
      setDeactivateConfirmId(null);
    } catch (err) {
      const { status, message } = getAxiosError(err);
      setDeactivateError({
        id: student.id,
        message:
          status === 409
            ? "This student has upcoming lessons and cannot be turned off."
            : message,
      });
    } finally {
      setDeactivateLoading(false);
    }
  };

  // ── Reactivate ───────────────────────────────────────────────────────────

  const handleReactivate = async (student: Student) => {
    setReactivateLoading(true);
    try {
      await api.patch(
        `/admin/students/${student.id}`,
        { is_active: true }
      );
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_active: true } : s))
      );
      setReactivateConfirmId(null);
    } catch (err) {
      // Reactivation has no blocking conditions
      console.error("[admin/students] failed to reactivate:", err);
    } finally {
      setReactivateLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────

  if (!authChecked) return null;

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">Students</h1>
            <p className="text-charcoal/60 text-sm mt-1">Manage student accounts.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-charcoal border border-black/5">
              {totalCount} total
            </span>
            <span className="px-3 py-1 bg-emerald-primary/10 rounded-full text-xs font-medium text-emerald-primary">
              {activeCount} active
            </span>
            <button
              data-testid="btn-add-student"
              onClick={() => { setShowCreate((v) => !v); setCreateError(""); }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
            >
              {showCreate ? <X size={16} /> : <Plus size={16} />}
              {showCreate ? "Cancel" : "Add Student"}
            </button>
          </div>
        </div>

        {/* ── Create success banner ──────────────────────────────────────── */}
        {successBanner && (
          <CredentialBanner
            variant="create"
            role="student"
            name={successBanner.name}
            email={successBanner.email}
            password={successBanner.password}
            emailSent={successBanner.emailSent}
            emailError={successBanner.emailError}
            onDismiss={() => setSuccessBanner(null)}
          />
        )}

        {/* ── Reset password banner ──────────────────────────────────────── */}
        {resetBanner && (
          <CredentialBanner
            variant="reset"
            role="student"
            name={resetBanner.name}
            email={resetBanner.email}
            password={resetBanner.password}
            emailSent={resetBanner.emailSent}
            emailError={resetBanner.emailError}
            onDismiss={() => setResetBanner(null)}
          />
        )}

        {/* ── Create form ───────────────────────────────────────────────── */}
        {showCreate && (
          <div data-testid="create-form" className="mb-6 bg-white rounded-2xl border border-black/5 p-6">
            <h2 className="font-semibold text-charcoal mb-5">New student</h2>
            <form onSubmit={handleCreate} className="space-y-4">

              {/* Row 1: name, email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Full name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" data-testid="input-display-name" value={createForm.display_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="e.g. Aisha Rahman" required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input type="email" data-testid="input-email" value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="student@example.com" required className={inputClass} />
                </div>
              </div>

              {/* Row 2: phone, guardian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Phone</label>
                  <input type="tel" data-testid="input-phone" value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+44 7700 000000" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Guardian name</label>
                  <input type="text" data-testid="input-guardian" value={createForm.guardian_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, guardian_name: e.target.value }))}
                    placeholder="Parent or guardian" className={inputClass} />
                </div>
              </div>

              {/* Assigned teacher */}
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Assigned teacher</label>
                <select data-testid="input-teacher" value={createForm.teacher_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, teacher_id: e.target.value }))}
                  className={inputClass}>
                  <option value="">— Not assigned —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </select>
              </div>

              {/* Pricing: rate + currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">
                    Hourly rate <span className="text-red-500">*</span>
                  </label>
                  <input type="number" data-testid="input-hourly-rate" value={createForm.hourly_rate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                    placeholder="e.g. 25" step="0.01" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Currency</label>
                  <select data-testid="input-currency" value={createForm.currency}
                    onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value as "GBP" | "EGP" }))}
                    className={inputClass}>
                    <option value="GBP">GBP (£)</option>
                    <option value="EGP">EGP</option>
                  </select>
                </div>
              </div>

              {/* Legacy pricing + notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <label className="flex items-center gap-2 cursor-pointer select-none pt-5">
                  <input type="checkbox" data-testid="checkbox-legacy" checked={createForm.is_legacy_pricing}
                    onChange={(e) => setCreateForm((f) => ({ ...f, is_legacy_pricing: e.target.checked }))}
                    className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30" />
                  <span className="text-sm text-charcoal/70">Legacy pricing</span>
                </label>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Pricing notes</label>
                  <input type="text" data-testid="input-pricing-notes" value={createForm.pricing_notes}
                    onChange={(e) => setCreateForm((f) => ({ ...f, pricing_notes: e.target.value }))}
                    placeholder="e.g. Agreed rate Jan 2024" className={inputClass} />
                </div>
              </div>

              {/* Prepaid bundle (optional, all-or-nothing) */}
              <div className="pt-2 border-t border-black/5">
                <p className="text-xs font-medium text-charcoal/50 mb-3">
                  Prepaid bundle — optional, leave blank to skip
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Bundle label</label>
                    <input type="text" data-testid="input-package-name" value={createForm.package_name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, package_name: e.target.value }))}
                      placeholder="e.g. 10-lesson pack" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Total lessons</label>
                    <input type="number" data-testid="input-total-lessons" value={createForm.total_lessons}
                      onChange={(e) => setCreateForm((f) => ({ ...f, total_lessons: e.target.value }))}
                      placeholder="e.g. 10" min="1" step="1" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Expiry date</label>
                    <input type="date" data-testid="input-expires-at" value={createForm.expires_at}
                      onChange={(e) => setCreateForm((f) => ({ ...f, expires_at: e.target.value }))}
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Temporary password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={showCreatePassword ? "text" : "password"} data-testid="input-temp-password"
                      value={createForm.temp_password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, temp_password: e.target.value }))}
                      placeholder="Leave blank to auto-generate" className={inputClass + " pr-10"} />
                    <button type="button" onClick={() => setShowCreatePassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal transition-colors">
                      {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button type="button" data-testid="btn-generate-password"
                    onClick={() => { setCreateForm((f) => ({ ...f, temp_password: generatePassword() })); setShowCreatePassword(true); }}
                    className="px-3 py-2 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors whitespace-nowrap">
                    Generate for me
                  </button>
                </div>
              </div>

              {/* Send email */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" data-testid="checkbox-send-email" checked={createForm.send_email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, send_email: e.target.checked }))}
                  className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30" />
                <span className="text-sm text-charcoal/70">Send welcome email with login details</span>
              </label>

              {createError && (
                <p data-testid="create-error" className="text-sm text-red-600">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" data-testid="btn-submit-create" disabled={createLoading}
                  className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                  {createLoading ? "Adding…" : "Add student"}
                </button>
                <button type="button"
                  onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Search ────────────────────────────────────────────────────── */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" />
          <input type="text" data-testid="search-input" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 focus:border-emerald-primary transition-all" />
        </div>

        {/* ── List / empty states ───────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <div data-testid="empty-no-students" className="text-center py-20">
            <UserPlus size={40} className="mx-auto text-charcoal/20 mb-4" />
            <p className="text-charcoal/50 text-sm">No students yet. Add your first student above.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div data-testid="empty-no-results" className="text-center py-20">
            <Search size={40} className="mx-auto text-charcoal/20 mb-4" />
            <p className="text-charcoal/50 text-sm">No students match your search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((student) => (
              <PersonCard
                key={student.id}
                role="student"
                person={student}
                teachers={teachers}
                isEditing={editingId === student.id}
                editForm={editForm}
                editLoading={editLoading}
                editError={editError}
                onEditStart={() => startEdit(student)}
                onEditFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                onEditSave={() => handleEditSave(student.id)}
                onEditCancel={() => setEditingId(null)}
                resetConfirm={resetConfirmId === student.id}
                resetLoading={resetLoading}
                onResetStart={() => { setResetConfirmId(student.id); setDeactivateConfirmId(null); setEditingId(null); }}
                onResetConfirm={() => handleResetPassword(student)}
                onResetCancel={() => setResetConfirmId(null)}
                deactivateConfirm={deactivateConfirmId === student.id}
                deactivateLoading={deactivateLoading}
                deactivateError={deactivateError?.id === student.id ? deactivateError.message : null}
                onDeactivateStart={() => { setDeactivateConfirmId(student.id); setDeactivateError(null); setResetConfirmId(null); setEditingId(null); }}
                onDeactivateConfirm={() => handleDeactivate(student)}
                onDeactivateCancel={() => { setDeactivateConfirmId(null); setDeactivateError(null); }}
                reactivateConfirm={reactivateConfirmId === student.id}
                reactivateLoading={reactivateLoading}
                onReactivateStart={() => { setReactivateConfirmId(student.id); setDeactivateConfirmId(null); setResetConfirmId(null); setEditingId(null); }}
                onReactivateConfirm={() => handleReactivate(student)}
                onReactivateCancel={() => setReactivateConfirmId(null)}
                inputClass={inputClass}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
