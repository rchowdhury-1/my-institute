"use client";

import { motion } from "framer-motion";
import Button from "@/components/shared/Button";

export default function Hero() {
  return (
    <section className="pattern-hero min-h-screen flex items-center justify-center pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-12 bg-gold/60" />
            <span className="text-gold text-xs font-semibold tracking-[0.2em] uppercase">
              Online Islamic Education
            </span>
            <div className="h-px w-12 bg-gold/60" />
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6 max-w-4xl mx-auto">
            Private Online Lessons in{" "}
            <span className="text-gold italic">Quran, Arabic</span>
            <br className="hidden sm:block" />
            {" "}& Islamic Studies
          </h1>

          <p className="text-lg md:text-xl text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed">
            Expert teachers. Flexible scheduling. All ages and levels welcome.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Button href="/free-trial" variant="gold" className="px-8 py-4 text-base">
              Book a Free Trial
            </Button>
            <Button
              href="/packages"
              className="px-8 py-4 text-base bg-white/10 text-white border-2 border-white/30 hover:bg-white hover:text-emerald-primary rounded-full font-semibold transition-all"
            >
              View Packages
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
            <span>30-minute lessons</span>
            <span className="text-gold/60">·</span>
            <span>All ages</span>
            <span className="text-gold/60">·</span>
            <span>Experienced teachers</span>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-white/30 text-xs tracking-widest uppercase">Scroll</span>
            <motion.div
              className="w-px h-8 bg-white/20"
              animate={{ scaleY: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
