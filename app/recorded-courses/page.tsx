import type { Metadata } from "next";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";
import Badge from "@/components/shared/Badge";
import Button from "@/components/shared/Button";
import CoursesList from "@/components/courses/CoursesList";

export const metadata: Metadata = {
  title: "Recorded Courses",
  description:
    "Learn Quran at your own pace with our recorded courses. Expert teaching available to watch anywhere, anytime.",
};

export default function RecordedCoursesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Self-Paced Learning
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Recorded Courses
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Learn at your own pace, on your own schedule. Expert teaching brought
            to your screen whenever you&apos;re ready.
          </p>
        </div>
      </section>

      <Section>
        <AnimatedSection>
          <CoursesList />
        </AnimatedSection>
      </Section>

      {/* CTA */}
      <section className="pattern-hero py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <h2 className="font-display text-3xl font-bold text-white mb-6">
              Prefer Live Lessons?
            </h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              Our live one-to-one lessons offer personalised attention and real-time
              feedback from expert teachers.
            </p>
            <Button href="/packages" variant="gold">
              View Live Lesson Packages
            </Button>
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
