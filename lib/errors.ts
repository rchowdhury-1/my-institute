export function getAxiosError(err: unknown): { status?: number; message: string } {
  const e = err as { response?: { status?: number; data?: { error?: string } } };
  return {
    status: e?.response?.status,
    message: e?.response?.data?.error ?? "Something went wrong.",
  };
}
