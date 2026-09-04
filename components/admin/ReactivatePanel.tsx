import ConfirmPanel from "@/components/admin/ConfirmPanel";

interface ReactivatePanelProps {
  displayName: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ReactivatePanel({ displayName, loading, error, onConfirm, onCancel }: ReactivatePanelProps) {
  return (
    <ConfirmPanel
      testIdPrefix="reactivate"
      panelClass="bg-emerald-50 border-emerald-200"
      message={<>Turn on {displayName}&apos;s access? They will be able to log in again.</>}
      confirmLabel="Yes, turn on"
      loadingLabel="Turning on…"
      confirmButtonClass="bg-emerald-500 hover:bg-emerald-600"
      loading={loading}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
