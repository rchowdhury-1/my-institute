interface ReactivatePanelProps {
  displayName: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ReactivatePanel({ displayName, loading, error, onConfirm, onCancel }: ReactivatePanelProps) {
  return (
    <div data-testid="reactivate-confirm-panel" className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
      <p className="text-sm text-charcoal mb-3">
        Turn on {displayName}&apos;s access? They will be able to log in again.
      </p>
      {error && (
        <p data-testid="reactivate-error" className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button data-testid="btn-reactivate-confirm" onClick={onConfirm} disabled={loading}
          className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-60 transition-colors">
          {loading ? "Turning on…" : "Yes, turn on"}
        </button>
        <button data-testid="btn-reactivate-cancel" onClick={onCancel}
          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
