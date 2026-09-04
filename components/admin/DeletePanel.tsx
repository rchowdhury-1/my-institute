import ConfirmPanel from "@/components/admin/ConfirmPanel";

interface DeletePanelProps {
  displayName: string;
  loading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeletePanel({ displayName, loading, error, onConfirm, onCancel }: DeletePanelProps) {
  return (
    <ConfirmPanel
      testIdPrefix="delete"
      panelClass="bg-red-50 border-red-200"
      message={
        <>
          Permanently delete {displayName}&apos;s account? This removes all their lessons, packages,
          homework and messages, and cannot be undone.
        </>
      }
      confirmLabel="Yes, delete permanently"
      loadingLabel="Deleting…"
      confirmButtonClass="bg-red-600 hover:bg-red-700"
      loading={loading}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
