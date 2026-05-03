-- ============================================================================
-- Users table + user_role enum (Vantage CRM)
-- Matches app roles: Admin, Manager (General Manager), Manager1, Digital Marketer, Telecaller
-- ============================================================================

-- 1a. Create enum on fresh databases (full set)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'Admin',
    'Manager',
    'Manager1',
    'Digital Marketer',
    'Telecaller'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1b. Existing DBs: old script only had Admin, Manager, Telecaller — add missing labels safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'Manager1'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'Manager1';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'Digital Marketer'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'Digital Marketer';
    END IF;
  END IF;
END$$;

-- 2. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'Telecaller',
  status        TEXT NOT NULL DEFAULT 'Active',
  phone         TEXT,
  initials      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- 2b. Columns expected by the app (safe on existing tables)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS manager_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reports_to_gm_id TEXT;

COMMENT ON COLUMN public.users.position IS 'Optional job title / label shown in Users UI';
COMMENT ON COLUMN public.users.manager_id IS 'For Telecallers: JSON array of Manager/Manager1 user ids, e.g. ["mgrA","mgrB"], or legacy single uuid text';
COMMENT ON COLUMN public.users.reports_to_gm_id IS 'For Manager1: optional General Manager (role Manager) user id they report to';

-- 3. Comments
COMMENT ON TABLE public.users IS 'CRM users: Admin, Manager (GM), Manager1, Digital Marketer, Telecaller';

-- 4. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies (development-friendly anon access)
DROP POLICY IF EXISTS "users_select_anon" ON public.users;
DROP POLICY IF EXISTS "users_insert_anon" ON public.users;
DROP POLICY IF EXISTS "users_update_anon" ON public.users;
DROP POLICY IF EXISTS "users_delete_anon" ON public.users;

CREATE POLICY "users_select_anon"
  ON public.users FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "users_insert_anon"
  ON public.users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "users_update_anon"
  ON public.users FOR UPDATE
  TO anon
  USING (true);

CREATE POLICY "users_delete_anon"
  ON public.users FOR DELETE
  TO anon
  USING (true);

-- 6. Seed data
INSERT INTO public.users (id, name, email, password, role, status, initials, created_at)
VALUES (
  'admin-1',
  'Admin User',
  'admin@estatescrm.com',
  'admin123',
  'Admin',
  'Active',
  'AU',
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, name, email, password, role, status, initials, phone, created_at)
VALUES
  ('u1', 'Rahul Sharma',  'rahul@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'RS', '+91 98765-11111', now()),
  ('u2', 'Priya Mehta',   'priya@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'PM', '+91 98765-22222', now()),
  ('u3', 'Arjun Patel',   'arjun@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'AP', '+91 98765-33333', now()),
  ('u4', 'Sneha Gupta',   'sneha@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'SG', '+91 98765-44444', now())
ON CONFLICT (id) DO NOTHING;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON public.users(manager_id);

-- 8. Verify
SELECT 'Users table + user_role enum ready' AS message;
SELECT id, name, email, role, status, position, manager_id FROM public.users LIMIT 10;
