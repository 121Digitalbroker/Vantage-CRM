/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** "true" | "false" — local demo leads in localStorage */
  readonly VITE_USE_DEMO_LEADS?: string;
  /** "true" | "false" — local demo users in localStorage vs Supabase users table */
  readonly VITE_USE_DEMO_USERS?: string;
  /** CRM users.id for new leads with no assignee (default admin-1) */
  readonly VITE_DEFAULT_NEW_LEAD_ASSIGNEE_ID?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
