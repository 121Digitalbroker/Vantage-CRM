/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** "true" | "false" — local demo leads in localStorage */
  readonly VITE_USE_DEMO_LEADS?: string;
  /** "true" | "false" — local demo users in localStorage vs Supabase users table */
  readonly VITE_USE_DEMO_USERS?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
