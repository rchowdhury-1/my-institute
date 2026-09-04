export function getAxiosError(err: unknown): { status?: number; code?: string; message: string } {
  const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } };
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
