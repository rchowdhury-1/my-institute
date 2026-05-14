"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
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

export default function CommunityPreview() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    api
      .get("/newsfeed/homepage")
      .then((res) => setPosts(res.data.posts ?? []))
      .catch(() => {});
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal mb-3">
              From Our Community
            </h2>
            <p className="text-charcoal/50 text-sm max-w-md mx-auto">
              Quotes, achievements, and updates from our community.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post, i) => (
            <AnimatedSection key={post.id} delay={i * 0.1}>
              <div className="bg-cream rounded-2xl border border-black/5 overflow-hidden h-full flex flex-col">
                {post.image_url && (
                  <div className="h-40 bg-cream-dark overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <span
                    className={`self-start px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${TYPE_BADGE[post.type]}`}
                  >
                    {TYPE_LABEL[post.type]}
                  </span>
                  <h3 className="font-display text-base font-bold text-charcoal mb-1.5">
                    {post.title}
                  </h3>
                  <p className="text-charcoal/55 text-sm leading-relaxed flex-1">
                    {post.body.length > 100
                      ? post.body.slice(0, 100) + "…"
                      : post.body}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection delay={0.3}>
          <div className="text-right mt-6">
            <Link
              href="/community"
              className="text-emerald-primary text-sm font-semibold hover:underline"
            >
              View all &rarr;
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
