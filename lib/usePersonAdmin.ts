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

type AccountActionType = "reset" | "deactivate" | "reactivate" | "delete";

interface PendingAction {
  type: AccountActionType;
  personId: string;
  loading: boolean;
  error?: string;
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

  // Only one confirm/loading/error triple, shared by every account action
  // (reset/deactivate/reactivate/delete) — a single pending action per hook
  // instance guarantees mutual exclusion by construction, instead of every
  // start* function having to remember to clear every sibling's state.
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // ── Edit ──────────────────────────────────────────────────────────────

  function startEdit(person: T) {
    setEditingId(person.id);
    setEditForm(buildEditForm(person));
    setEditError("");
    setPendingAction(null);
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

  // ── Account actions (reset / deactivate / reactivate / delete) ────────

  function startAction(type: AccountActionType, personId: string) {
    setPendingAction({ type, personId, loading: false });
    setEditingId(null);
  }

  function cancelAction() {
    setPendingAction(null);
  }

  async function confirmAction(type: AccountActionType, person: T) {
    setPendingAction({ type, personId: person.id, loading: true });

    try {
      if (type === "reset") {
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
        setItems((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, must_change_password: true } : p))
        );
        setPendingAction(null);
        return;
      }

      if (type === "deactivate") {
        await api.patch(`${basePath}/${person.id}`, { is_active: false });
        setItems((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, is_active: false } : p))
        );
        setPendingAction(null);
        return;
      }

      if (type === "reactivate") {
        await api.patch(`${basePath}/${person.id}`, { is_active: true });
        setItems((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, is_active: true } : p))
        );
        setPendingAction(null);
        return;
      }

      // delete
      const res = await api.delete(`${basePath}/${person.id}`);
      setItems((prev) => prev.filter((p) => p.id !== person.id));
      setPendingAction(null);
      const rescheduleRequestsRemoved: number = res.data?.rescheduleRequestsRemoved ?? 0;
      if (rescheduleRequestsRemoved > 0) {
        alert(
          `${person.display_name}'s account was deleted. This also removed ${rescheduleRequestsRemoved} reschedule request${rescheduleRequestsRemoved === 1 ? "" : "s"} tied to their account.`
        );
      }
    } catch (err) {
      const { status, message } = getAxiosError(err);
      const errorMessage =
        type === "deactivate" && status === 409
          ? `This ${entityType} has upcoming lessons and cannot be turned off.`
          : message;
      setPendingAction({ type, personId: person.id, loading: false, error: errorMessage });
    }
  }

  function accountActionFor(person: T): {
    type: AccountActionType;
    confirming: boolean;
    loading: boolean;
    error?: string;
  } | null {
    if (!pendingAction || pendingAction.personId !== person.id) return null;
    return {
      type: pendingAction.type,
      confirming: true,
      loading: pendingAction.loading,
      error: pendingAction.error,
    };
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

    accountActionFor,
    startAction,
    confirmAction,
    cancelAction,
  };
}
