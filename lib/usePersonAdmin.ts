"use client";

import { useCallback, useState } from "react";
import api from "@/lib/api";
import { getAxiosError } from "@/lib/errors";

interface BasePerson {
  id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
}

export interface CredentialBannerState {
  personId: string;
  name: string;
  password: string;
  email: string;
  emailSent: boolean;
  emailError?: string;
}

interface PersonAdminOptions<T> {
  /** Builds the initial edit-form values from a person, e.g. for populating inputs. */
  buildEditForm: (person: T) => Partial<T>;
  /** Builds the PATCH payload from the current edit form. Defaults to sending the form as-is. */
  buildEditPayload?: (form: Partial<T>) => Record<string, unknown>;
}

export function usePersonAdmin<T extends BasePerson>(
  entityType: "teacher" | "student",
  options: PersonAdminOptions<T>
) {
  const basePath = `/admin/${entityType}s`;
  const listKey = `${entityType}s`;
  const { buildEditForm, buildEditPayload = (form: Partial<T>) => form as Record<string, unknown> } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(basePath);
      setItems(res.data[listKey] ?? res.data);
    } catch (err) {
      console.error(`Fetch ${listKey} error:`, err);
      setLoadError(`Failed to load ${listKey}. Please refresh the page.`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, listKey]);

  const [resetBanner, setResetBanner] = useState<CredentialBannerState | null>(null);

  // Per-card state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<T>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<{ id: string; message: string } | null>(null);

  const [reactivateConfirmId, setReactivateConfirmId] = useState<string | null>(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [reactivateError, setReactivateError] = useState<{ id: string; message: string } | null>(null);

  // ── Edit ──────────────────────────────────────────────────────────────

  function startEdit(person: T) {
    setEditingId(person.id);
    setEditForm(buildEditForm(person));
    setEditError("");
    setResetConfirmId(null);
    setDeactivateConfirmId(null);
  }

  function updateEditForm(patch: Partial<T>) {
    setEditForm((f) => ({ ...f, ...patch }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEditSave(id: string) {
    setEditError("");
    setEditLoading(true);
    try {
      const res = await api.patch(`${basePath}/${id}`, buildEditPayload(editForm));
      const updated: Partial<T> = res.data[entityType] ?? res.data;
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      setEditingId(null);
    } catch (err) {
      const { status, message } = getAxiosError(err);
      setEditError(
        status === 409 ? "Someone with this email address already exists." : message
      );
    } finally {
      setEditLoading(false);
    }
  }

  // ── Reset password ───────────────────────────────────────────────────

  function startReset(id: string) {
    setResetConfirmId(id);
    setDeactivateConfirmId(null);
    setEditingId(null);
  }

  function cancelReset() {
    setResetConfirmId(null);
  }

  async function confirmReset(person: T) {
    setResetLoading(true);
    try {
      const res = await api.post(`${basePath}/${person.id}/reset-password`, {});
      const tempPassword: string = res.data.temp_password ?? res.data.tempPassword;
      setResetBanner({
        personId: person.id,
        name: person.display_name,
        password: tempPassword,
        email: person.email,
        emailSent: res.data.email_sent ?? false,
        emailError: res.data.email_error || undefined,
      });
      setResetConfirmId(null);
      setItems((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, must_change_password: true } : p))
      );
    } catch (err) {
      console.error("Reset password error:", err);
      alert(getAxiosError(err).message);
    } finally {
      setResetLoading(false);
    }
  }

  // ── Deactivate ────────────────────────────────────────────────────────

  function startDeactivate(id: string) {
    setDeactivateConfirmId(id);
    setDeactivateError(null);
    setResetConfirmId(null);
    setEditingId(null);
  }

  function cancelDeactivate() {
    setDeactivateConfirmId(null);
    setDeactivateError(null);
  }

  async function confirmDeactivate(person: T) {
    setDeactivateLoading(true);
    setDeactivateError(null);
    try {
      await api.patch(`${basePath}/${person.id}`, { is_active: false });
      setItems((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, is_active: false } : p))
      );
      setDeactivateConfirmId(null);
    } catch (err) {
      const { status, message } = getAxiosError(err);
      setDeactivateError({
        id: person.id,
        message:
          status === 409
            ? `This ${entityType} has upcoming lessons and cannot be turned off.`
            : message,
      });
    } finally {
      setDeactivateLoading(false);
    }
  }

  // ── Reactivate ────────────────────────────────────────────────────────

  function startReactivate(id: string) {
    setReactivateConfirmId(id);
    setDeactivateConfirmId(null);
    setResetConfirmId(null);
    setEditingId(null);
  }

  function cancelReactivate() {
    setReactivateConfirmId(null);
    setReactivateError(null);
  }

  async function confirmReactivate(person: T) {
    setReactivateLoading(true);
    setReactivateError(null);
    try {
      await api.patch(`${basePath}/${person.id}`, { is_active: true });
      setItems((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, is_active: true } : p))
      );
      setReactivateConfirmId(null);
    } catch (err) {
      const { message } = getAxiosError(err);
      setReactivateError({ id: person.id, message });
    } finally {
      setReactivateLoading(false);
    }
  }

  type AccountActionType = "reset" | "deactivate" | "reactivate";

  function accountActionFor(person: T): {
    type: AccountActionType;
    confirming: boolean;
    loading: boolean;
    error?: string;
  } | null {
    if (resetConfirmId === person.id) {
      return { type: "reset", confirming: true, loading: resetLoading };
    }
    if (deactivateConfirmId === person.id) {
      return {
        type: "deactivate",
        confirming: true,
        loading: deactivateLoading,
        error: deactivateError?.id === person.id ? deactivateError.message : undefined,
      };
    }
    if (reactivateConfirmId === person.id) {
      return {
        type: "reactivate",
        confirming: true,
        loading: reactivateLoading,
        error: reactivateError?.id === person.id ? reactivateError.message : undefined,
      };
    }
    return null;
  }

  function startAction(type: AccountActionType, id: string) {
    if (type === "reset") startReset(id);
    else if (type === "deactivate") startDeactivate(id);
    else startReactivate(id);
  }

  function confirmAction(type: AccountActionType, person: T) {
    if (type === "reset") return confirmReset(person);
    if (type === "deactivate") return confirmDeactivate(person);
    return confirmReactivate(person);
  }

  function cancelAction(type: AccountActionType) {
    if (type === "reset") cancelReset();
    else if (type === "deactivate") cancelDeactivate();
    else cancelReactivate();
  }

  return {
    items,
    setItems,
    loading,
    loadError,
    fetchItems,

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
    resetConfirmId,
    resetLoading,
    startReset,
    confirmReset,
    cancelReset,

    deactivateConfirmId,
    deactivateLoading,
    deactivateError,
    startDeactivate,
    confirmDeactivate,
    cancelDeactivate,

    reactivateConfirmId,
    reactivateLoading,
    reactivateError,
    startReactivate,
    confirmReactivate,
    cancelReactivate,

    accountActionFor,
    startAction,
    confirmAction,
    cancelAction,
  };
}
