/**
 * Minimal CORS for browser requests from CRM (SPA) to Express APIs.
 */
export function applyEmailApiCors(req, res) {
  const origin = req.get("Origin") || "";
  const appBase = String(process.env.APP_BASE_URL || "").replace(/\/$/, "");
  const dev = process.env.NODE_ENV !== "production";

  if (origin && dev) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (appBase && origin === appBase) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (dev) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
