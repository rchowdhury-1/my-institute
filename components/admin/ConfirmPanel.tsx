import { ReactNode } from "react";

interface ConfirmPanelProps {
  testIdPrefix: string;
  panelClass: string;
  message: ReactNode;
  confirmLabel: string;
  loadingLabel: string;
  confirmButtonClass: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared confirm/cancel panel shape used for account actions (deactivate, reactivate, delete). */
export default function ConfirmPanel({
  testIdPrefix,
  panelClass,
  message,
  confirmLabel,
  loadingLabel,
  confirmButtonClass,
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmPanelProps) {
  return (
    <div data-testid={`${testIdPrefix}-confirm-panel`} className={`mt-4 p-3 border rounded-xl ${panelClass}`}>
      <p className="text-sm text-charcoal mb-3">{message}</p>
      {error && (
        <p data-testid={`${testIdPrefix}-error`} className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button data-testid={`btn-${testIdPrefix}-confirm`} onClick={onConfirm} disabled={loading}
          className={`px-4 py-1.5 rounded-full text-white text-xs font-semibold disabled:opacity-60 transition-colors ${confirmButtonClass}`}>
          {loading ? loadingLabel : confirmLabel}
        </button>
        <button data-testid={`btn-${testIdPrefix}-cancel`} onClick={onCancel}
          className="px-4 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-black/20 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
