import Link from "next/link";
import { Heart } from "lucide-react";

export default function RevertBanner() {
  return (
    <section className="py-10 bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/learn-about-islam"
          className="block bg-white rounded-2xl border border-black/5 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-12 h-12 rounded-full bg-emerald-primary/10 flex items-center justify-center shrink-0">
              <Heart size={20} className="text-emerald-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg md:text-xl font-bold text-charcoal mb-1">
                New to Islam? Free guidance available.
              </h3>
              <p className="text-charcoal/50 text-sm">
                Free Quran classes, mentorship, and a welcoming community for new Muslims.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center px-4 py-2 rounded-full bg-gold text-white text-sm font-semibold group-hover:bg-gold-dark transition-colors shrink-0">
              Learn more &rarr;
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
