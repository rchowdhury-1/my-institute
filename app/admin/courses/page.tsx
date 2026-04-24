"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Plus, Trash2, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  video_url?: string;
  duration_minutes?: number;
  position: number;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  price: string;
  is_free: boolean;
  thumbnail_url?: string;
  lesson_count: number;
  created_at: string;
}

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", is_free: false, thumbnail_url: "" });

  // Lessons
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [lessonForm, setLessonForm] = useState<Record<string, { title: string; video_url: string; duration_minutes: string }>>({});
  const [addingLesson, setAddingLesson] = useState<string | null>(null);

  function authHeaders() {
    const token = localStorage.getItem("accessToken");
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    if (!token || (role !== "admin" && role !== "supervisor")) { router.push("/login"); return; }
    api.get("/courses", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setCourses(res.data.courses))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate() {
    if (!form.title) return;
    setCreating(true);
    try {
      const res = await api.post("/courses", {
        title: form.title,
        description: form.description || undefined,
        price: form.is_free ? 0 : parseFloat(form.price) || 0,
        is_free: form.is_free,
        thumbnail_url: form.thumbnail_url || undefined,
      }, { headers: authHeaders() });
      setCourses(prev => [{ ...res.data.course, lesson_count: 0 }, ...prev]);
      setForm({ title: "", description: "", price: "", is_free: false, thumbnail_url: "" });
      setShowForm(false);
    } catch {
      alert("Failed to create course.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this course and all its lessons?")) return;
    try {
      await api.delete(`/courses/${id}`, { headers: authHeaders() });
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch {
      alert("Failed to delete course.");
    }
  }

  async function loadLessons(courseId: string) {
    if (expandedCourse === courseId) { setExpandedCourse(null); return; }
    if (lessons[courseId]) { setExpandedCourse(courseId); return; }
    try {
      const res = await api.get(`/courses/${courseId}`, { headers: authHeaders() });
      setLessons(prev => ({ ...prev, [courseId]: res.data.lessons }));
      setExpandedCourse(courseId);
    } catch {
      alert("Failed to load lessons.");
    }
  }

  async function handleAddLesson(courseId: string) {
    const lf = lessonForm[courseId];
    if (!lf?.title) return;
    setAddingLesson(courseId);
    try {
      const existingLessons = lessons[courseId] ?? [];
      const res = await api.post(`/courses/${courseId}/lessons`, {
        title: lf.title,
        video_url: lf.video_url || undefined,
        duration_minutes: lf.duration_minutes ? parseInt(lf.duration_minutes) : undefined,
        position: existingLessons.length,
      }, { headers: authHeaders() });
      setLessons(prev => ({ ...prev, [courseId]: [...(prev[courseId] ?? []), res.data.lesson] }));
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, lesson_count: c.lesson_count + 1 } : c));
      setLessonForm(prev => ({ ...prev, [courseId]: { title: "", video_url: "", duration_minutes: "" } }));
    } catch {
      alert("Failed to add lesson.");
    } finally {
      setAddingLesson(null);
    }
  }

  async function handleDeleteLesson(courseId: string, lessonId: string) {
    if (!confirm("Delete this lesson?")) return;
    try {
      await api.delete(`/courses/${courseId}/lessons/${lessonId}`, { headers: authHeaders() });
      setLessons(prev => ({ ...prev, [courseId]: prev[courseId].filter(l => l.id !== lessonId) }));
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, lesson_count: Math.max(0, c.lesson_count - 1) } : c));
    } catch {
      alert("Failed to delete lesson.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-charcoal">Recorded Courses</h1>
            <p className="text-charcoal/50 text-sm mt-1">Create and manage courses with lessons</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light transition-colors">
            <Plus size={16} /> Add Course
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border border-black/5 p-6 mb-8">
            <h2 className="font-display text-lg font-bold text-charcoal mb-4">New Course</h2>
            <div className="space-y-3">
              <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Course title *"
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Description" rows={3}
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 resize-none" />
              <input type="url" value={form.thumbnail_url} onChange={e => setForm(p => ({ ...p, thumbnail_url: e.target.value }))}
                placeholder="Thumbnail URL (optional)"
                className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_free} onChange={e => setForm(p => ({ ...p, is_free: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-charcoal">Free course</span>
                </label>
                {!form.is_free && (
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="Price (£)"
                    className="w-32 px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleCreate} disabled={creating || !form.title}
                  className="px-5 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                  {creating ? "Creating…" : "Create Course"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2 rounded-full border border-black/10 text-charcoal/60 text-sm hover:border-black/20 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5 p-10 text-center text-charcoal/30">
            <PlayCircle size={32} className="mx-auto mb-3 text-charcoal/20" />
            <p>No courses yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map(course => (
              <div key={course.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-charcoal">{course.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${course.is_free ? "bg-emerald-primary/10 text-emerald-primary" : "bg-gold/10 text-gold"}`}>
                        {course.is_free ? "Free" : `£${parseFloat(course.price).toFixed(2)}`}
                      </span>
                    </div>
                    {course.description && <p className="text-xs text-charcoal/50 mt-1 leading-relaxed">{course.description}</p>}
                    <p className="text-xs text-charcoal/30 mt-1">{course.lesson_count} lesson{course.lesson_count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => loadLessons(course.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs hover:border-emerald-primary hover:text-emerald-primary transition-colors">
                      {expandedCourse === course.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      Lessons
                    </button>
                    <button onClick={() => handleDelete(course.id)}
                      className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expandedCourse === course.id && (
                  <div className="border-t border-black/5 bg-cream/50 p-5">
                    {(lessons[course.id] ?? []).length > 0 && (
                      <div className="space-y-2 mb-4">
                        {(lessons[course.id] ?? []).map((lesson, i) => (
                          <div key={lesson.id} className="flex items-center justify-between gap-4 bg-white rounded-xl px-4 py-3 border border-black/5">
                            <div>
                              <p className="text-sm font-medium text-charcoal">{i + 1}. {lesson.title}</p>
                              {lesson.duration_minutes && <p className="text-xs text-charcoal/40">{lesson.duration_minutes} min</p>}
                              {lesson.video_url && (
                                <a href={lesson.video_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-emerald-primary hover:underline">Watch video</a>
                              )}
                            </div>
                            <button onClick={() => handleDeleteLesson(course.id, lesson.id)}
                              className="p-1 text-charcoal/30 hover:text-red-500 transition-colors shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-white rounded-xl border border-black/5 p-4">
                      <p className="text-xs font-semibold text-charcoal/50 mb-3 uppercase tracking-wide">Add Lesson</p>
                      <div className="space-y-2">
                        <input type="text"
                          value={lessonForm[course.id]?.title ?? ""}
                          onChange={e => setLessonForm(prev => ({ ...prev, [course.id]: { ...prev[course.id] ?? { title: "", video_url: "", duration_minutes: "" }, title: e.target.value } }))}
                          placeholder="Lesson title *"
                          className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input type="url"
                            value={lessonForm[course.id]?.video_url ?? ""}
                            onChange={e => setLessonForm(prev => ({ ...prev, [course.id]: { ...prev[course.id] ?? { title: "", video_url: "", duration_minutes: "" }, video_url: e.target.value } }))}
                            placeholder="Video URL (optional)"
                            className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                          <input type="number"
                            value={lessonForm[course.id]?.duration_minutes ?? ""}
                            onChange={e => setLessonForm(prev => ({ ...prev, [course.id]: { ...prev[course.id] ?? { title: "", video_url: "", duration_minutes: "" }, duration_minutes: e.target.value } }))}
                            placeholder="Duration (minutes)"
                            className="px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30" />
                        </div>
                        <button onClick={() => handleAddLesson(course.id)} disabled={addingLesson === course.id || !lessonForm[course.id]?.title}
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors">
                          <Plus size={14} /> {addingLesson === course.id ? "Adding…" : "Add Lesson"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
