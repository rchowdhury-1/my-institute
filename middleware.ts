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
    prefixes: ["/scholarship", "/donate", "/admin/scholarships"],
    flag: "NEXT_PUBLIC_FEATURE_SCHOLARSHIP_SPONSORSHIP",
  },
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
  const dashboardPaths = [
    "/student",
    "/teacher",
    "/supervisor",
    "/admin",
  ];
  const isDashboard = dashboardPaths.some((p) => pathname.startsWith(p));

  if (isDashboard) {
    // refreshToken is httpOnly and set by the Render backend domain — Next.js
    // middleware on the Vercel domain cannot read cross-domain cookies.
    // userRole is set by frontend JS after login (same domain) and is the
    // correct signal to use here. Every page also verifies the JWT itself.
    const role = request.cookies.get("userRole")?.value;
    if (!role) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname.startsWith("/student") && role && role !== "student") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (
      pathname.startsWith("/teacher") &&
      role &&
      role !== "teacher" &&
      role !== "admin"
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (
      pathname.startsWith("/supervisor") &&
      role &&
      role !== "supervisor" &&
      role !== "admin"
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname.startsWith("/admin") && role && role !== "admin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Dashboard routes (auth-protected)
    "/student/:path*",
    "/teacher/:path*",
    "/supervisor/:path*",
    "/admin/:path*",
    // Phase 2B public routes (feature-gated)
    "/recorded-courses/:path*",
    "/scholarship/:path*",
    "/donate/:path*",
  ],
};
