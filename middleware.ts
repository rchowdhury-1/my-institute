import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const refreshToken = request.cookies.get("refreshToken");

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = request.cookies.get("userRole")?.value;

  if (pathname.startsWith("/student") && role && role !== "student") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/teacher") && role && role !== "teacher" && role !== "admin") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/supervisor") && role && role !== "supervisor" && role !== "admin") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/supervisor/:path*"],
};
