import { Pencil, KeyRound, UserX, UserCheck } from "lucide-react";

export interface PersonCardTeacher {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  specialisation: string | null;
  bio: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

export interface PersonCardStudent {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  guardian_name: string | null;
  teacher_id: string | null;
  hourly_rate: string | null;
  currency: string;
  is_legacy_pricing: boolean;
  pricing_notes: string | null;
  is_active: boolean;
  must_change_password: boolean;
  package_name: string | null;
  sessions_remaining: number | null;
  expires_at: string | null;
}

export interface PersonCardTeacherOption {
  id: string;
  display_name: string;
}

function formatRate(rate: string | null, currency: string): string {
  if (!rate) return "—";
  const num = parseFloat(rate);
  if (isNaN(num)) return "—";
  return currency === "GBP" ? `£${num.toFixed(2)}/hour` : `EGP ${num.toFixed(2)}/hour`;
}

interface PersonCardBaseProps {
  isEditing: boolean;
  editLoading: boolean;
  editError: string;
  onEditStart: () => void;
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
  reactivateConfirm: boolean;
  reactivateLoading: boolean;
  onReactivateStart: () => void;
  onReactivateConfirm: () => void;
  onReactivateCancel: () => void;
  inputClass: string;
}

type PersonCardProps = PersonCardBaseProps & (
  | {
      role: "teacher";
      person: PersonCardTeacher;
      editForm: Partial<PersonCardTeacher>;
      onEditFormChange: (patch: Partial<PersonCardTeacher>) => void;
    }
  | {
      role: "student";
      person: PersonCardStudent;
      teachers: PersonCardTeacherOption[];
      editForm: Partial<PersonCardStudent>;
      onEditFormChange: (patch: Partial<PersonCardStudent>) => void;
    }
);

export default function PersonCard(props: PersonCardProps) {
  const {
    role,
    person,
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
    reactivateConfirm,
    reactivateLoading,
    onReactivateStart,
    onReactivateConfirm,
    onReactivateCancel,
    inputClass,
  } = props;

  const cardTestId = role === "teacher" ? `teacher-card-${person.id}` : `student-card-${person.id}`;
  const assignedTeacher = role === "student" ? props.teachers.find((t) => t.id === person.teacher_id) : undefined;

  return (
    <div
      data-testid={cardTestId}
      className={`bg-white rounded-2xl border p-5 transition-all ${person.is_active ? "border-black/5" : "border-black/5 opacity-70"}`}
    >
      {isEditing ? (
        // ── Edit mode ──────────────────────────────────────────────────
        <div className="space-y-4">
          <h3 className="font-semibold text-charcoal text-sm">{role === "teacher" ? "Edit teacher" : "Edit student"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Full name</label>
              <input type="text" data-testid="edit-display-name"
                value={(editForm.display_name as string) ?? ""}
                onChange={(e) => onEditFormChange({ display_name: e.target.value })}
                required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Email</label>
              <input type="email" data-testid="edit-email"
                value={(editForm.email as string) ?? ""}
                onChange={(e) => onEditFormChange({ email: e.target.value })}
                required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Phone</label>
              <input type="tel" data-testid="edit-phone"
                value={(editForm.phone as string) ?? ""}
                onChange={(e) => onEditFormChange({ phone: e.target.value })}
                className={inputClass} />
            </div>
            {role === "teacher" ? (
              <div>
                <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Specialisation</label>
                <input type="text" data-testid="edit-specialisation"
                  value={(editForm.specialisation as string) ?? ""}
                  onChange={(e) => onEditFormChange({ specialisation: e.target.value })}
                  className={inputClass} />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Guardian name</label>
                  <input type="text" data-testid="edit-guardian"
                    value={(editForm.guardian_name as string) ?? ""}
                    onChange={(e) => onEditFormChange({ guardian_name: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Assigned teacher</label>
                  <select data-testid="edit-teacher"
                    value={(editForm.teacher_id as string) ?? ""}
                    onChange={(e) => onEditFormChange({ teacher_id: e.target.value || null })}
                    className={inputClass}>
                    <option value="">— Not assigned —</option>
                    {props.teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Hourly rate</label>
                  <input type="number" data-testid="edit-hourly-rate"
                    value={(editForm.hourly_rate as string) ?? ""}
                    onChange={(e) => onEditFormChange({ hourly_rate: e.target.value })}
                    min="0.01" step="0.01" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Currency</label>
                  <select data-testid="edit-currency"
                    value={(editForm.currency as string) ?? "GBP"}
                    onChange={(e) => onEditFormChange({ currency: e.target.value })}
                    className={inputClass}>
                    <option value="GBP">GBP (£)</option>
                    <option value="EGP">EGP</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" data-testid="edit-legacy"
                    checked={(editForm.is_legacy_pricing as boolean) ?? false}
                    onChange={(e) => onEditFormChange({ is_legacy_pricing: e.target.checked })}
                    className="w-4 h-4 rounded border-black/20 text-emerald-primary focus:ring-emerald-primary/30" />
                  <label className="text-sm text-charcoal/70 cursor-pointer">Legacy pricing</label>
                </div>
              </>
            )}
          </div>
          {role === "teacher" ? (
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Bio</label>
              <textarea data-testid="edit-bio"
                value={(editForm.bio as string) ?? ""}
                onChange={(e) => onEditFormChange({ bio: e.target.value })}
                rows={3}
                className={inputClass + " resize-none"} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-charcoal/60 mb-1.5">Pricing notes</label>
              <input type="text" data-testid="edit-pricing-notes"
                value={(editForm.pricing_notes as string) ?? ""}
                onChange={(e) => onEditFormChange({ pricing_notes: e.target.value })}
                className={inputClass} />
            </div>
          )}
          {editError && <p data-testid="edit-error" className="text-sm text-red-600">{editError}</p>}
          <div className="flex gap-3">
            <button data-testid="btn-edit-save" onClick={onEditSave} disabled={editLoading}
              className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
              {editLoading ? "Saving…" : "Save"}
            </button>
            <button data-testid="btn-edit-cancel" onClick={onEditCancel}
              className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // ── View mode ──────────────────────────────────────────────────
        <div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              {/* Name + badges */}
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="font-semibold text-charcoal">{person.display_name}</h3>
                {person.is_active ? (
                  <span data-testid="badge-active" className="px-2 py-0.5 rounded-full bg-emerald-primary/10 text-emerald-primary text-xs font-medium">
                    Active
                  </span>
                ) : (
                  <span data-testid="badge-turned-off" className="px-2 py-0.5 rounded-full bg-charcoal/10 text-charcoal/50 text-xs font-medium">
                    Turned off
                  </span>
                )}
                {person.must_change_password && (
                  <span data-testid="badge-awaiting-login" className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                    Awaiting first login
                  </span>
                )}
              </div>

              {/* Email + phone */}
              <p className="text-sm text-charcoal/60">{person.email}</p>
              {person.phone && <p className="text-sm text-charcoal/50 mt-0.5">{person.phone}</p>}

              {role === "teacher" ? (
                person.specialisation && (
                  <p className="text-xs text-charcoal/40 mt-1">{person.specialisation}</p>
                )
              ) : (
                <>
                  {/* Rate pill — e.g. "£7.00/hour · Legacy · note" */}
                  <p data-testid="rate-pill" className="text-xs text-charcoal/50 mt-1">
                    {formatRate(person.hourly_rate, person.currency)}
                    {person.is_legacy_pricing && (
                      <span className="text-charcoal/35"> · Legacy</span>
                    )}
                    {person.pricing_notes && (
                      <span className="text-charcoal/35"> · {person.pricing_notes}</span>
                    )}
                  </p>

                  {/* Guardian + teacher */}
                  {person.guardian_name && (
                    <p className="text-xs text-charcoal/40 mt-0.5">Guardian: {person.guardian_name}</p>
                  )}
                  {assignedTeacher && (
                    <p className="text-xs text-charcoal/40 mt-0.5">Teacher: {assignedTeacher.display_name}</p>
                  )}

                  {/* Bundle info — e.g. "10 lessons remaining · expires 1 Jan 2026" */}
                  {person.package_name && (
                    <p data-testid="bundle-info" className="text-xs text-charcoal/40 mt-1">
                      {person.sessions_remaining ?? 0} lessons remaining
                      {person.expires_at && (
                        <span className="ml-1">
                          · expires {new Date(person.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Action buttons */}
            {person.is_active ? (
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <button data-testid="btn-edit" onClick={onEditStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
                  <Pencil size={13} /> Edit
                </button>
                <button data-testid="btn-reset-password" onClick={onResetStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
                  <KeyRound size={13} /> Reset password
                </button>
                <button data-testid="btn-deactivate" onClick={onDeactivateStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors">
                  <UserX size={13} /> Turn off access
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button data-testid="btn-reactivate" onClick={onReactivateStart}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-600 text-xs hover:bg-emerald-50 transition-colors">
                  <UserCheck size={13} /> Turn on access
                </button>
              </div>
            )}
          </div>

          {/* Reset confirm panel */}
          {resetConfirm && (
            <div data-testid="reset-confirm-panel" className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-charcoal mb-3">
                Reset {person.display_name}&apos;s password? They will receive a new temporary password and must change it on next login.
              </p>
              <div className="flex gap-2">
                <button data-testid="btn-reset-confirm" onClick={onResetConfirm} disabled={resetLoading}
                  className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors">
                  {resetLoading ? "Resetting…" : "Yes, reset password"}
                </button>
                <button data-testid="btn-reset-cancel" onClick={onResetCancel}
                  className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Deactivate confirm panel */}
          {deactivateConfirm && (
            <div data-testid="deactivate-confirm-panel" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-charcoal mb-3">
                Turn off {person.display_name}&apos;s access? They will no longer be able to log in.
              </p>
              {deactivateError && (
                <p data-testid="deactivate-error" className="text-xs text-red-600 mb-2">{deactivateError}</p>
              )}
              <div className="flex gap-2">
                <button data-testid="btn-deactivate-confirm" onClick={onDeactivateConfirm} disabled={deactivateLoading}
                  className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
                  {deactivateLoading ? "Turning off…" : "Yes, turn off"}
                </button>
                <button data-testid="btn-deactivate-cancel" onClick={onDeactivateCancel}
                  className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reactivate confirm panel */}
          {reactivateConfirm && (
            <div data-testid="reactivate-confirm-panel" className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-sm text-charcoal mb-3">
                Turn on {person.display_name}&apos;s access? They will be able to log in again.
              </p>
              <div className="flex gap-2">
                <button data-testid="btn-reactivate-confirm" onClick={onReactivateConfirm} disabled={reactivateLoading}
                  className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-60 transition-colors">
                  {reactivateLoading ? "Turning on…" : "Yes, turn on"}
                </button>
                <button data-testid="btn-reactivate-cancel" onClick={onReactivateCancel}
                  className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
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
