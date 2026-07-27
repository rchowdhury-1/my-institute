"use client";

import { useRouter } from "next/navigation";
import api from "@/lib/api";

/**
 * Returns a logout handler: clears the session and redirects to /login.
 * Deliberate: logout must not block on API failure, so the /auth/logout
 * call's rejection is swallowed rather than surfaced.
 */
export function useLogout() {
  const router = useRouter();

  return async () => {
    await api.post("/auth/logout", {}).catch((err) => console.warn("logout API call failed", err));
    localStorage.clear();
    document.cookie = "userRole=; path=/; max-age=0";
    router.push("/login");
  };
}
