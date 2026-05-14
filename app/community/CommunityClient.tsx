"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Badge from "@/components/shared/Badge";
import Section from "@/components/shared/Section";
import AnimatedSection from "@/components/shared/AnimatedSection";

interface Post {
  id: string;
  type: "quote" | "honour_list" | "general";
  title: string;
  body: string;
  image_url: string | null;
  published_at: string;
}

const TYPE_BADGE: Record<string, string> = {
  quote: "bg-purple-100 text-purple-700",
  honour_list: "bg-gold/15 text-gold-dark",
  general: "bg-emerald-primary/10 text-emerald-primary",
};

const TYPE_LABEL: Record<string, string> = {
  quote: "Quote",
  honour_list: "Honour List",
  general: "Update",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CommunityClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/newsfeed?page=${page}`)
      .then((res) => {
        setPosts(res.data.posts);
        setTotalPages(res.data.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      {/* Hero */}
      <section className="pattern-hero pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="gold" className="mb-4">
            Community
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Community
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Quotes, achievements, and updates from MY Institute.
          </p>
        </div>
      </section>

      <Section>
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-emerald-primary/30 border-t-emerald-primary rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-charcoal/40 py-20">
              No posts yet. Check back soon!
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {posts.map((post, i) => (
                  <AnimatedSection key={post.id} delay={i * 0.05}>
                    <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm h-full flex flex-col">
                      {post.image_url && (
                        <div className="h-48 bg-cream overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[post.type]}`}
                          >
                            {TYPE_LABEL[post.type]}
                          </span>
                          <span className="text-xs text-charcoal/30">
                            {formatDate(post.published_at)}
                          </span>
                        </div>
                        <h2 className="font-display text-lg font-bold text-charcoal mb-2">
                          {post.title}
                        </h2>
                        <p className="text-charcoal/60 text-sm leading-relaxed flex-1">
                          {post.body}
                        </p>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setPage(p);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`w-9 h-9 rounded-full text-sm font-semibold transition-all ${
                          p === page
                            ? "bg-emerald-primary text-white"
                            : "bg-white text-charcoal/60 border border-black/10 hover:border-emerald-primary/40"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Section>
    </>
  );
}
