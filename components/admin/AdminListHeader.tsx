import { Plus, X } from "lucide-react";

interface AdminListHeaderProps {
  title: string;
  description: string;
  totalCount: number;
  activeCount: number;
  showCreate: boolean;
  onToggleCreate: () => void;
  addLabel: string;
  addTestId?: string;
}

/** Shared title/count-pills/add-button header for the admin students & teachers list pages. */
export default function AdminListHeader({
  title,
  description,
  totalCount,
  activeCount,
  showCreate,
  onToggleCreate,
  addLabel,
  addTestId,
}: AdminListHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-charcoal">{title}</h1>
        <p className="text-charcoal/60 text-sm mt-1">{description}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-3 py-1 bg-white rounded-full text-xs font-medium text-charcoal border border-black/5">
          {totalCount} total
        </span>
        <span className="px-3 py-1 bg-emerald-primary/10 rounded-full text-xs font-medium text-emerald-primary">
          {activeCount} active
        </span>
        <button
          data-testid={addTestId}
          onClick={onToggleCreate}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
        >
          {showCreate ? <X size={16} /> : <Plus size={16} />}
          {showCreate ? "Cancel" : addLabel}
        </button>
      </div>
    </div>
  );
}
