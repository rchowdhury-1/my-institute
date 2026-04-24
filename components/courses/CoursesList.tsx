"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PlayCircle, Check, Lock } from "lucide-react";

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

export default function CoursesList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<string[]>([]);

  useEffect(() => {
    api.get("/courses")
      .then(res => setCourses(res.data.courses))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleEnroll(course: Course) {
    const token = localStorage.getItem("accessToken");
    if (!token) { window.location.href = "/login"; return; }
    setEnrolling(course.id);
    try {
      await api.post(`/courses/${course.id}/enroll`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setEnrolled(prev => [...prev, course.id]);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { whatsapp_url?: string } } };
      if (e?.response?.status === 402 && e?.response?.data?.whatsapp_url) {
        window.open(e.response.data.whatsapp_url, "_blank");
      } else {
        alert("Failed to enroll. Please try again.");
      }
    } finally {
      setEnrolling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="py-12 text-center text-charcoal/40">
        <PlayCircle size={40} className="mx-auto mb-4 text-charcoal/20" />
        <p>No courses available yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {courses.map(course => (
        <div key={course.id} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
          {course.thumbnail_url ? (
            <div className="h-44 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="h-44 bg-emerald-primary/5 flex items-center justify-center">
              <PlayCircle size={40} className="text-emerald-primary/30" />
            </div>
          )}
          <div className="p-5 flex flex-col flex-1">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-display text-lg font-bold text-charcoal leading-snug">{course.title}</h3>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${course.is_free ? "bg-emerald-primary/10 text-emerald-primary" : "bg-gold/10 text-gold"}`}>
                {course.is_free ? "Free" : `£${parseFloat(course.price).toFixed(2)}`}
              </span>
            </div>
            {course.description && (
              <p className="text-charcoal/60 text-sm leading-relaxed mb-3 flex-1">{course.description}</p>
            )}
            <p className="text-xs text-charcoal/30 mb-4">{course.lesson_count} lesson{course.lesson_count !== 1 ? "s" : ""}</p>

            {enrolled.includes(course.id) ? (
              <div className="flex items-center gap-2 text-emerald-primary text-sm font-semibold">
                <Check size={16} /> Enrolled
              </div>
            ) : (
              <button
                onClick={() => handleEnroll(course)}
                disabled={enrolling === course.id}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-emerald-primary text-white text-sm font-semibold hover:bg-emerald-light disabled:opacity-60 transition-colors"
              >
                {enrolling === course.id ? (
                  "Enrolling…"
                ) : course.is_free ? (
                  <><Check size={15} /> Enroll Free</>
                ) : (
                  <><Lock size={15} /> Enroll — £{parseFloat(course.price).toFixed(2)}</>
                )}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
