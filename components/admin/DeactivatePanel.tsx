import ConfirmPanel from "@/components/admin/ConfirmPanel";

interface DeactivatePanelProps {
  displayName: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeactivatePanel({ displayName, loading, error, onConfirm, onCancel }: DeactivatePanelProps) {
  return (
    <ConfirmPanel
      testIdPrefix="deactivate"
      panelClass="bg-red-50 border-red-200"
      message={<>Turn off {displayName}&apos;s access? They will no longer be able to log in.</>}
      confirmLabel="Yes, turn off"
      loadingLabel="Turning off…"
      confirmButtonClass="bg-red-500 hover:bg-red-600"
      loading={loading}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
