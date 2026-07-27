import Link from "next/link";
import { Users, GraduationCap, Newspaper, Clock, Heart } from "lucide-react";
import type { User } from "@/app/supervisor/page";

interface PeopleTabProps {
  students: User[];
  teachers: User[];
}

export default function PeopleTab({ students, teachers }: PeopleTabProps) {
  return (
    <div>
    <div className="flex flex-wrap gap-3 mb-6">
      <Link
        href="/admin/teachers"
        data-testid="link-manage-teachers"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
      >
        <Users size={15} /> Manage Teachers →
      </Link>
      <Link
        href="/admin/students"
        data-testid="link-manage-students"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
      >
        <GraduationCap size={15} /> Manage Students →
      </Link>
      <Link
        href="/admin/newsfeed"
        data-testid="link-manage-newsfeed"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
      >
        <Newspaper size={15} /> Manage Community →
      </Link>
      <Link
        href="/admin/salaries"
        data-testid="link-teacher-salaries"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
      >
        <Clock size={15} /> Teacher Salaries →
      </Link>
      <Link
        href="/admin/revert-applications"
        data-testid="link-manage-reverts"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors"
      >
        <Heart size={15} /> Revert Applications →
      </Link>
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="font-display text-xl font-bold text-charcoal mb-4">
          Students <span className="text-sm font-normal text-charcoal/40">({students.length})</span>
        </h2>
        <div className="space-y-2">
          {students.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-black/5 px-4 py-3">
              <p className="font-semibold text-charcoal text-sm">{s.display_name}</p>
              <p className="text-charcoal/40 text-xs">{s.email}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-charcoal mb-4">
          Teachers <span className="text-sm font-normal text-charcoal/40">({teachers.length})</span>
        </h2>
        <div className="space-y-2">
          {teachers.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-black/5 px-4 py-3">
              <p className="font-semibold text-charcoal text-sm">{t.display_name}</p>
              <p className="text-charcoal/40 text-xs">{t.email}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
