/**
 * Minimal CORS for browser requests from CRM (SPA) to Express APIs.
 * When API is on api.* and SPA on crm.*, set CORS_ALLOWED_ORIGINS=https://crm.example.com
 * (comma-separated). APP_BASE_URL alone must match Origin exactly.
 */
export function applyEmailApiCors(req, res) {
  const origin = req.get("Origin") || "";
  const appBase = String(process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const extra = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const dev = process.env.NODE_ENV !== "production";

  const allowOrigin =
    (origin && dev) ||
    (appBase && origin === appBase) ||
    (origin && extra.includes(origin));

  if (allowOrigin && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (dev) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
