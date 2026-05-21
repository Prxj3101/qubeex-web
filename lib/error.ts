export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: unknown }).response === "object"
  ) {
    const response = (err as { response?: { data?: { message?: unknown; error?: unknown } } }).response;
    const msg = response?.data?.message ?? response?.data?.error;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
