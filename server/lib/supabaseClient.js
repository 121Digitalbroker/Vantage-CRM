import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const key = serviceKey || anonKey;

if (!supabaseUrl || !key) {
  console.warn(
    "[supabase] Missing SUPABASE_URL/VITE_SUPABASE_URL or anon/service key — /api/test-db and Meta webhook will fail until set."
  );
}

/** Server Supabase: prefers service role (bypasses RLS) when SUPABASE_SERVICE_ROLE_KEY is set. */
const supabase = createClient(supabaseUrl ?? "", key ?? "");

export default supabase;
