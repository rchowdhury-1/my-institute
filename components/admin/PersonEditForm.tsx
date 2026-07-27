import type { PersonCardStudent, PersonCardTeacher, PersonCardTeacherOption } from "@/components/admin/PersonCard";

type PersonEditFormProps =
  | {
      role: "teacher";
      editForm: Partial<PersonCardTeacher>;
      onEditFormChange: (patch: Partial<PersonCardTeacher>) => void;
      editLoading: boolean;
      editError: string;
      onEditSave: () => void;
      onEditCancel: () => void;
      inputClass: string;
    }
  | {
      role: "student";
      teachers: PersonCardTeacherOption[];
      editForm: Partial<PersonCardStudent>;
      onEditFormChange: (patch: Partial<PersonCardStudent>) => void;
      editLoading: boolean;
      editError: string;
      onEditSave: () => void;
      onEditCancel: () => void;
      inputClass: string;
    };

export default function PersonEditForm(props: PersonEditFormProps) {
  const { role, editForm, onEditFormChange, editLoading, editError, onEditSave, onEditCancel, inputClass } = props;

  return (
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
  );
}
