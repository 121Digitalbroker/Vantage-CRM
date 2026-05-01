import supabase from "../lib/supabaseClient.js";
import {
  extractLeadgenIds,
  fetchLeadFromGraph,
  handleWebhookVerification,
  leadRowFromGraphLead,
  verifyMetaSignature,
} from "../lib/metaLeadWebhook.js";
import { noDeprecation } from "node:process";

/**
 * GET — Meta webhook verification (paste Callback URL in Meta → Webhooks).
 * POST — Leadgen notifications; verifies signature, fetches lead via Graph, upserts into Supabase.
 */
export default async function metaWebhookHandler(req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    return handleWebhookVerification(req, res);
  }

  if (req.method !== "POST") {
    return res.sendStatus(405);
  }

  const rawBody = req.rawBody;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(500).send("Server misconfigured: raw body missing");
  }

  const sig = req.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, sig)) {
    return res.sendStatus(403);
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }

  const leadgenIds = extractLeadgenIds(body);
  if (leadgenIds.length === 0) {
    return res.status(200).json({ ok: true, processed: 0, message: "no leadgen events" });
  }

  const results = [];
  for (const leadgenId of leadgenIds) {
    try {
      const graphLead = await fetchLeadFromGraph(leadgenId);
      const row = leadRowFromGraphLead(graphLead, leadgenId);

      const { data: existing, error: findErr } = await supabase
        .from("leads")
        .select("id")
        .eq("facebook_lead_id", leadgenId)
        .maybeSingle();

      if (findErr) throw new Error(findErr.message);

      if (existing?.id) {
        const { error: upErr } = await supabase
          .from("leads")
          .update(row)
          .eq("id", existing.id);
        if (upErr) throw new Error(upErr.message);
        results.push({ leadgenId, action: "updated", id: existing.id });
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("leads")
          .insert(row)
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        results.push({ leadgenId, action: "inserted", id: inserted?.id });
      }
    } catch (e) {
      results.push({
        leadgenId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const failed = results.filter((r) => r.error);
  if (failed.length === results.length) {
    return res.status(500).json({ ok: false, results });
  }
  return res.status(200).json({ ok: true, results });
}
