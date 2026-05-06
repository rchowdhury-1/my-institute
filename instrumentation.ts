/**
 * Next.js instrumentation hook — runs once on server startup.
 * Initialises Sentry only when NEXT_PUBLIC_SENTRY_DSN is set and
 * @sentry/nextjs is installed. Safe to deploy without the package.
 */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs");
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.1,
      });
    } catch {
      console.warn("[Sentry] @sentry/nextjs not installed — error tracking disabled");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs");
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 0.1,
      });
    } catch {
      // edge runtime — ignore if not installed
    }
  }
}
