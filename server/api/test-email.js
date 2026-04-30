import { applyEmailApiCors } from "../lib/emailCors.js";

/**
 * POST { to: string, subject?: string, secret?: string }
 * Manual Resend test (Lead Rotation page).
 *
 * Env: RESEND_API_KEY, MAIL_FROM
 * Optional: TEST_EMAIL_SECRET — if set, body.secret must match.
 */
export default async function testEmailHandler(req, res) {
  applyEmailApiCors(req, res);

  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (req.method !== "POST") return res.sendStatus(405);

  const serverSecret = process.env.TEST_EMAIL_SECRET;
  if (serverSecret && String(req.body?.secret ?? "") !== serverSecret) {
    return res.status(401).json({
      ok: false,
      error: "Invalid or missing test email secret",
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) {
    return res.status(500).json({
      ok: false,
      error: "Server missing RESEND_API_KEY or MAIL_FROM",
    });
  }

  const to = String(req.body?.to ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ ok: false, error: "Invalid recipient email" });
  }

  const subject =
    String(req.body?.subject ?? "").trim() || "CRM test — Lead rotation / Resend";

  const appBase =
    String(process.env.APP_BASE_URL || "").replace(/\/$/, "") || "(not set)";
  const html = `
    <p>This is a manual test email from your CRM backend via Resend.</p>
    <p><strong>APP_BASE_URL:</strong> ${appBase}</p>
    <p>If you see this message, DNS, API key, and <code>MAIL_FROM</code> are working.</p>
  `.trim();

  try {
    const rsp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await rsp.json().catch(() => ({}));

    if (!rsp.ok) {
      return res.status(502).json({
        ok: false,
        error: data.message || data.name || rsp.statusText || "Resend request failed",
        details: data,
      });
    }

    return res.status(200).json({
      ok: true,
      id: data.id,
      message: "Test email queued. Check Resend Logs and the inbox (spam too).",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
