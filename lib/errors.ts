// Axios transport-level codes for a request that never got a response in time.
const TIMEOUT_TRANSPORT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT"]);

export function getAxiosError(err: unknown): { status?: number; code?: string; message: string } {
  const e = err as {
    code?: string;
    response?: { status?: number; data?: { error?: string; code?: string } };
  };
  if (!e?.response && e?.code && TIMEOUT_TRANSPORT_CODES.has(e.code)) {
    return { message: "The server took too long to respond. Please try again in a minute." };
  }
  return {
    status: e?.response?.status,
    code: e?.response?.data?.code,
    message: e?.response?.data?.error ?? "Something went wrong.",
  };
}

/** Shorthand for the common "alert the backend's error message" catch-block pattern. */
export function reportError(err: unknown) {
  alert(getAxiosError(err).message);
}
