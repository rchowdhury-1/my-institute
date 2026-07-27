interface DeactivatePanelProps {
  displayName: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeactivatePanel({ displayName, loading, error, onConfirm, onCancel }: DeactivatePanelProps) {
  return (
    <div data-testid="deactivate-confirm-panel" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
      <p className="text-sm text-charcoal mb-3">
        Turn off {displayName}&apos;s access? They will no longer be able to log in.
      </p>
      {error && (
        <p data-testid="deactivate-error" className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button data-testid="btn-deactivate-confirm" onClick={onConfirm} disabled={loading}
          className="px-4 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
          {loading ? "Turning off…" : "Yes, turn off"}
        </button>
        <button data-testid="btn-deactivate-cancel" onClick={onCancel}
          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
