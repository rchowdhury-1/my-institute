import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  withCredentials: true,
});

// ─── Token refresh interceptor ───────────────────────────────────────────────
// When the access token (15 min) expires, automatically call /auth/refresh
// using the httpOnly refresh cookie and retry the original request.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers["Authorization"] = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      const newToken: string = res.data.accessToken;
      localStorage.setItem("accessToken", newToken);
      api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
      original.headers["Authorization"] = `Bearer ${newToken}`;
      processQueue(null, newToken);
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.clear();
      document.cookie = "userRole=; path=/; max-age=0";
      // Only redirect if not already on the login page to prevent a reload loop
      // when NotificationBell fires with a stale token while the user is on /login.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
