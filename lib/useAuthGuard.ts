"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirects to /login when there's no access token, or (when allowedRoles
 * is given) the stored role isn't one of them. Returns authChecked so the
 * caller can gate rendering/fetching until the check has run.
 */
export function useAuthGuard(allowedRoles?: string[]) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.push("/login");
      return;
    }
    if (allowedRoles) {
      const role = localStorage.getItem("userRole");
      if (!role || !allowedRoles.includes(role)) {
        router.push("/login");
        return;
      }
    }
    setAuthChecked(true);
    // allowedRoles is intentionally excluded — callers commonly pass a
    // fresh array literal each render, which would otherwise re-run this
    // effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return { authChecked };
}
