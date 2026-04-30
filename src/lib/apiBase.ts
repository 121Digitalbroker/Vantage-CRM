/** Express API origin — no trailing slash. */
export function getApiBaseUrl(): string {
  const env = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (env) return env.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:4000";
  // Production fallback for same-origin deployments (e.g. nginx proxying /api).
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}
