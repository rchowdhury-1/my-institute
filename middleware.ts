import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Phase 2B feature gates.
 * When a NEXT_PUBLIC_FEATURE_* var is not 'true', direct URL access to those
 * paths redirects to '/'. Nav items linking to these pages should also check
 * the same env vars before rendering (no central nav currently exists).
 */
const PHASE2B_GATES: Array<{ prefixes: string[]; flag: string }> = [
  {
    prefixes: ["/student/exams", "/teacher/exams"],
    flag: "NEXT_PUBLIC_FEATURE_EXAMS",
  },
  {
    prefixes: ["/teacher/payments"],
    flag: "NEXT_PUBLIC_FEATURE_TEACHER_SALARY",
  },
  {
    prefixes: ["/recorded-courses", "/admin/courses"],
    flag: "NEXT_PUBLIC_FEATURE_RECORDED_COURSES",
  },
  {
    prefixes: ["/student/messages", "/teacher/messages"],
    flag: "NEXT_PUBLIC_FEATURE_MESSAGING",
  },
  {
    prefixes: ["/admin/scholarships"],
    flag: "NEXT_PUBLIC_FEATURE_SCHOLARSHIP_SPONSORSHIP",
  },
];

/**
 * Dashboard route → roles allowed to access it. Data-driven so adding a
 * dashboard area is one row here instead of a new if-block.
 *
 * NOTE: `config.matcher` below must stay a static array literal (Next.js
 * parses it at build time and can't accept a computed value) — its dashboard
 * entries must mirror the prefixes here. The dev-only check after this file
 * loads catches drift between the two.
 */
const ROUTE_ROLES: Array<{ prefix: string; allowedRoles: string[] }> = [
  { prefix: "/student", allowedRoles: ["student"] },
  { prefix: "/teacher", allowedRoles: ["teacher", "admin"] },
  { prefix: "/supervisor", allowedRoles: ["supervisor", "admin"] },
  { prefix: "/admin", allowedRoles: ["admin"] },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Phase 2B feature gates (checked before auth so flag-off = home) ────────
  for (const gate of PHASE2B_GATES) {
    if (gate.prefixes.some((p) => pathname.startsWith(p))) {
      if (process.env[gate.flag] !== "true") {
        return NextResponse.redirect(new URL("/", request.url));
      }
      break;
    }
  }

  // ── Auth + role checks (dashboard routes only) ──────────────────────────────
  const routeRule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));

  if (routeRule) {
    // refreshToken is httpOnly and set by the Render backend domain — Next.js
    // middleware on the Vercel domain cannot read cross-domain cookies.
    // userRole is set by frontend JS after login (same domain) and is the
    // correct signal to use here. Every page also verifies the JWT itself.
    const role = request.cookies.get("userRole")?.value;
    if (!role || !routeRule.allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Dashboard routes (auth-protected) — must mirror ROUTE_ROLES above
    "/student/:path*",
    "/teacher/:path*",
    "/supervisor/:path*",
    "/admin/:path*",
    // Phase 2B feature-gated routes
    "/recorded-courses/:path*",
  ],
};

if (process.env.NODE_ENV !== "production") {
  const matcherPrefixes = config.matcher
    .filter((m) => m.endsWith("/:path*"))
    .map((m) => m.replace("/:path*", ""));
  for (const { prefix } of ROUTE_ROLES) {
    if (!matcherPrefixes.includes(prefix)) {
      console.warn(
        `[middleware] ROUTE_ROLES has "${prefix}" but config.matcher is missing it — this route would run role checks without middleware ever executing.`
      );
    }
  }
}
