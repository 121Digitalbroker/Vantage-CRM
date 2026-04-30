import crypto from "node:crypto";

const GRAPH_HOST = "https://graph.facebook.com";

function graphVersion() {
  const raw = (process.env.META_GRAPH_VERSION || "v21.0").trim();
  return raw.startsWith("v") ? raw : `v${raw}`;
}

function accessToken() {
  return (
    process.env.META_PAGE_ACCESS_TOKEN?.trim() ||
    process.env.META_ACCESS_TOKEN?.trim() ||
    ""
  );
}

function appSecret() {
  return process.env.META_APP_SECRET?.trim() || "";
}

function verifyToken() {
  return process.env.META_VERIFY_TOKEN?.trim() || "";
}

/** Verify X-Hub-Signature-256 against raw body (Meta Lead Ads webhooks). */
export function verifyMetaSignature(rawBody, signatureHeader) {
  if (process.env.META_SKIP_SIGNATURE_VERIFY === "true") {
    return true;
  }
  const secret = appSecret();
  if (!secret) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = String(signatureHeader || "").trim();
  if (!sig.startsWith("sha256=")) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function firstValue(values) {
  if (!Array.isArray(values) || values.length === 0) return "";
  const v = values[0];
  return v == null ? "" : String(v).trim();
}

function fieldMapFromLead(lead) {
  const map = new Map();
  for (const item of lead?.field_data ?? []) {
    const name = String(item?.name ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!name) continue;
    map.set(name, firstValue(item?.values));
  }
  return map;
}

function pickFromMap(map, keys) {
  for (const k of keys) {
    const v = map.get(k);
    if (v) return v;
  }
  return "";
}

function buildName(map) {
  const full = pickFromMap(map, ["full_name", "full name", "name"]);
  if (full) return full;
  const first = pickFromMap(map, ["first_name", "first name", "firstname"]);
  const last = pickFromMap(map, ["last_name", "last name", "lastname"]);
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || "Meta lead";
}

function buildPhone(map) {
  return pickFromMap(map, [
    "phone_number",
    "phone",
    "mobile_number",
    "mobile",
    "contact_number",
  ]);
}

function buildEmail(map) {
  return pickFromMap(map, ["email", "email_address", "work_email"]);
}

function buildProject(map) {
  return pickFromMap(map, [
    "project",
    "project_interested",
    "project_name",
    "which_project_are_you_interested_in?",
    "property",
  ]);
}

function buildNotes(map, leadgenId) {
  const lines = [];
  for (const [k, v] of map.entries()) {
    if (
      [
        "full_name",
        "first_name",
        "last_name",
        "phone_number",
        "email",
        "project",
      ].includes(k)
    ) {
      continue;
    }
    if (v) lines.push(`${k}: ${v}`);
  }
  const extra = lines.length ? lines.join("\n") : "";
  const header = `Imported from Meta Lead Ads (leadgen_id: ${leadgenId})`;
  return extra ? `${header}\n${extra}` : header;
}

/**
 * Map Graph API lead object → public.leads row (snake_case, matches leadsService mapToRow).
 * Does not set id — DB default gen_random_uuid() / serial.
 */
export function leadRowFromGraphLead(lead, leadgenId) {
  const map = fieldMapFromLead(lead);
  const name = buildName(map);
  const phone = buildPhone(map) || "—";
  const email = buildEmail(map) || null;
  const project = buildProject(map) || "—";
  const notes = buildNotes(map, leadgenId);

  const row = {
    name,
    phone,
    email,
    source: "Facebook Lead Ads",
    project,
    status: "New",
    lead_level: "Cold",
    assigned_to: null,
    follow_up_date: new Date().toISOString(),
    facebook_lead_id: String(leadgenId),
    campaign_id: lead.campaign_id ?? null,
    adset_id: lead.adset_id ?? null,
    ad_id: lead.ad_id ?? null,
    form_id: lead.form_id ?? null,
    is_organic: false,
    notes,
  };

  if (lead.created_time) {
    const d = new Date(lead.created_time);
    if (!Number.isNaN(d.getTime())) row.created_at = d.toISOString();
  }

  const budget = pickFromMap(map, [
    "what_is_your_budget?",
    "budget",
    "investment_budget",
    "what_is_your_investment_budget?",
  ]);
  if (budget) row.investment_budget = budget;

  const city = pickFromMap(map, ["city", "location", "which_city"]);
  if (city) row.city = city;

  const best = pickFromMap(map, [
    "best_time_to_call",
    "best_time_to_contact",
    "preferred_contact_time",
  ]);
  if (best) row.best_time_to_contact = best;

  const planning = pickFromMap(map, [
    "when_are_you_planning_to_buy?",
    "planning_to_buy",
  ]);
  if (planning) row.planning_to_buy = planning;

  return row;
}

export async function fetchLeadFromGraph(leadgenId) {
  const token = accessToken();
  if (!token) {
    throw new Error("Missing META_PAGE_ACCESS_TOKEN (or META_ACCESS_TOKEN)");
  }
  const v = graphVersion();
  const fields = [
    "id",
    "created_time",
    "field_data",
    "ad_id",
    "adset_id",
    "campaign_id",
    "form_id",
  ].join(",");
  const url = `${GRAPH_HOST}/${v}/${encodeURIComponent(
    leadgenId
  )}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(
    token
  )}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || "Graph error";
    throw new Error(msg);
  }
  return json;
}

export function extractLeadgenIds(body) {
  const ids = [];
  if (!body || body.object !== "page" || !Array.isArray(body.entry)) {
    return ids;
  }
  for (const entry of body.entry) {
    for (const change of entry?.changes ?? []) {
      if (change?.field === "leadgen" && change?.value?.leadgen_id) {
        ids.push(String(change.value.leadgen_id));
      }
    }
  }
  return [...new Set(ids)];
}

export function handleWebhookVerification(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && verifyToken() && token === verifyToken()) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.sendStatus(403);
}
