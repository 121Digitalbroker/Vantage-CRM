-- ============================================================================
-- Create Users Table for CRM (Telecallers, Admins, Managers)
-- ============================================================================

-- 1. Create ENUM for user roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('Admin', 'Manager', 'Telecaller');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,           -- e.g., 'admin-1', 'u1', 'u2'
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,              -- In production, hash this!
  role          user_role NOT NULL DEFAULT 'Telecaller',
  status        TEXT NOT NULL DEFAULT 'Active', -- 'Active' | 'Inactive'
  phone         TEXT,
  initials      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- 3. Add comments
COMMENT ON TABLE public.users IS 'CRM users: Admins, Managers, and Telecallers';

-- 4. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies (allow anon access for development)
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

-- 6. Insert default users (seed data)
-- Admin user
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

-- Sample telecallers
INSERT INTO public.users (id, name, email, password, role, status, initials, phone, created_at)
VALUES
  ('u1', 'Rahul Sharma',  'rahul@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'RS', '+91 98765-11111', now()),
  ('u2', 'Priya Mehta',   'priya@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'PM', '+91 98765-22222', now()),
  ('u3', 'Arjun Patel',   'arjun@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'AP', '+91 98765-33333', now()),
  ('u4', 'Sneha Gupta',   'sneha@estatescrm.com',  'telecaller123', 'Telecaller', 'Active', 'SG', '+91 98765-44444', now())
ON CONFLICT (id) DO NOTHING;

-- 7. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 8. Verify setup
SELECT 'Users table created successfully' as message;
SELECT * FROM public.users LIMIT 5;
