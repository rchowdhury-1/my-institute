interface ResetPasswordPanelProps {
  displayName: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ResetPasswordPanel({ displayName, loading, onConfirm, onCancel }: ResetPasswordPanelProps) {
  return (
    <div data-testid="reset-confirm-panel" className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
      <p className="text-sm text-charcoal mb-3">
        Reset {displayName}&apos;s password? They will receive a new temporary password and must change it on next login.
      </p>
      <div className="flex gap-2">
        <button data-testid="btn-reset-confirm" onClick={onConfirm} disabled={loading}
          className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors">
          {loading ? "Resetting…" : "Yes, reset password"}
        </button>
        <button data-testid="btn-reset-cancel" onClick={onCancel}
          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
