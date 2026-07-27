import UserSearchInput from "@/components/shared/UserSearchInput";
import { SESSION_STATUS_LABEL } from "@/lib/labels";
import type { User } from "@/app/supervisor/page";

interface SessionFilterBarProps {
  teachers: User[];
  students: User[];
  allStatuses: string[];
  filterTeacherId: string;
  filterStudentId: string;
  filterStatuses: Set<string>;
  onFilterTeacher: (id: string) => void;
  onFilterStudent: (id: string) => void;
  onToggleStatus: (status: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
}

export default function SessionFilterBar({
  teachers,
  students,
  allStatuses,
  filterTeacherId,
  filterStudentId,
  filterStatuses,
  onFilterTeacher,
  onFilterStudent,
  onToggleStatus,
  hasActiveFilters,
  onClearFilters,
  resultCount,
}: SessionFilterBarProps) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 p-3 mb-4 flex flex-wrap items-center gap-2">
      <select
        value={filterTeacherId}
        onChange={(e) => onFilterTeacher(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-black/10 bg-cream text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30"
      >
        <option value="">All teachers</option>
        {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
      </select>
      <div className="w-48">
        <UserSearchInput
          users={students}
          value={filterStudentId}
          onChange={onFilterStudent}
          placeholder="Filter student…"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {allStatuses.map(st => (
          <button
            key={st}
            onClick={() => onToggleStatus(st)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
              filterStatuses.has(st)
                ? "bg-emerald-primary/10 border-emerald-primary/30 text-emerald-primary"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            {SESSION_STATUS_LABEL[st]}
          </button>
        ))}
      </div>
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="px-2.5 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors"
        >
          Clear
        </button>
      )}
      <span className="text-[10px] text-charcoal/30 ml-auto">
        {resultCount} session{resultCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
