import { Pencil, KeyRound, UserX, UserCheck } from "lucide-react";
import PersonEditForm from "@/components/admin/PersonEditForm";
import ResetPasswordPanel from "@/components/admin/ResetPasswordPanel";
import DeactivatePanel from "@/components/admin/DeactivatePanel";
import ReactivatePanel from "@/components/admin/ReactivatePanel";

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

export type AccountAction = {
  type: "reset" | "deactivate" | "reactivate";
  confirming: boolean;
  loading: boolean;
  error?: string;
} | null;

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
  accountAction: AccountAction;
  onActionStart: (type: "reset" | "deactivate" | "reactivate") => void;
  onActionConfirm: () => void;
  onActionCancel: () => void;
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
    editLoading,
    editError,
    onEditStart,
    onEditSave,
    onEditCancel,
    accountAction,
    onActionStart,
    onActionConfirm,
    onActionCancel,
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
        role === "teacher" ? (
          <PersonEditForm
            role="teacher"
            editForm={props.editForm}
            onEditFormChange={props.onEditFormChange}
            editLoading={editLoading}
            editError={editError}
            onEditSave={onEditSave}
            onEditCancel={onEditCancel}
            inputClass={inputClass}
          />
        ) : (
          <PersonEditForm
            role="student"
            teachers={props.teachers}
            editForm={props.editForm}
            onEditFormChange={props.onEditFormChange}
            editLoading={editLoading}
            editError={editError}
            onEditSave={onEditSave}
            onEditCancel={onEditCancel}
            inputClass={inputClass}
          />
        )
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
                <button data-testid="btn-reset-password" onClick={() => onActionStart("reset")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
                  <KeyRound size={13} /> Reset password
                </button>
                <button data-testid="btn-deactivate" onClick={() => onActionStart("deactivate")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors">
                  <UserX size={13} /> Turn off access
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button data-testid="btn-reactivate" onClick={() => onActionStart("reactivate")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-600 text-xs hover:bg-emerald-50 transition-colors">
                  <UserCheck size={13} /> Turn on access
                </button>
              </div>
            )}
          </div>

          {accountAction?.type === "reset" && accountAction.confirming && (
            <ResetPasswordPanel
              displayName={person.display_name}
              loading={accountAction.loading}
              onConfirm={onActionConfirm}
              onCancel={onActionCancel}
            />
          )}

          {accountAction?.type === "deactivate" && accountAction.confirming && (
            <DeactivatePanel
              displayName={person.display_name}
              loading={accountAction.loading}
              error={accountAction.error}
              onConfirm={onActionConfirm}
              onCancel={onActionCancel}
            />
          )}

          {accountAction?.type === "reactivate" && accountAction.confirming && (
            <ReactivatePanel
              displayName={person.display_name}
              loading={accountAction.loading}
              error={accountAction.error}
              onConfirm={onActionConfirm}
              onCancel={onActionCancel}
            />
          )}
        </div>
      )}
    </div>
  );
}
