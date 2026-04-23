-- ============================================================
-- EstatesCRM - Supabase Migration
-- Run this in your Supabase dashboard: SQL Editor → New query
-- ============================================================

-- 1. Add missing columns to the existing `leads` table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_level        TEXT        DEFAULT 'Cold';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_name     TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS adset_name        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_name           TEXT;

-- 2. Fix the test row (currently has "s" placeholders)
UPDATE leads
SET
  lead_level     = 'Hot',
  status         = 'New',
  follow_up_date = NOW() + INTERVAL '1 day'
WHERE name = 's';

-- 3. Create telecallers reference table
CREATE TABLE IF NOT EXISTS telecallers (
  id         TEXT        PRIMARY KEY,         -- matches RoleContext ids: u1, u2, u3, u4
  name       TEXT        NOT NULL,
  email      TEXT,
  role       TEXT        DEFAULT 'Telecaller',
  status     TEXT        DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO telecallers (id, name, email, role) VALUES
  ('u1', 'Rahul Sharma', 'rahul@estatescrm.com', 'Telecaller'),
  ('u2', 'Priya Mehta',  'priya@estatescrm.com', 'Telecaller'),
  ('u3', 'Arjun Patel',  'arjun@estatescrm.com', 'Telecaller'),
  ('u4', 'Sneha Gupta',  'sneha@estatescrm.com', 'Telecaller')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert sample leads for testing assignment
INSERT INTO leads (name, phone, email, source, project, status, lead_level, assigned_to, follow_up_date, campaign_name, adset_name, ad_name, notes)
VALUES
  ('Alice Johnson',  '+91 98765-43210', 'alice@example.com',   'Meta Ads',   'Sunset Villas',        'Negotiation',         'Hot',  'u1', NOW(),                    'Summer Launch 2026',   'Delhi NCR · 30-45 yrs', 'Luxury Villa Ad 1',    ''),
  ('Michael Smith',  '+91 98765-43211', 'michael@example.com', 'Google Ads', 'Downtown Heights',     'Contacted',           'Warm', 'u2', NOW() - INTERVAL '1 day', 'Q2 Apartments',        'Noida · 25-35 yrs',     'Apartment Search Ad',  ''),
  ('Emma Watson',    '+91 98765-43212', NULL,                  'Referral',   'Oceanside Apartments', 'New',                 'Cold', 'u1', NOW() + INTERVAL '6 day', NULL,                   NULL,                    NULL,                   ''),
  ('James Brown',    '+91 98765-43213', 'james@example.com',   'Website',    'Sunset Villas',        'Site Visit Scheduled','Hot',  'u3', NOW(),                    'Brand Awareness',      'Mumbai · All ages',     'Villa Banner V2',      ''),
  ('Olivia Davis',   '+91 98765-43214', 'olivia@example.com',  'Meta Ads',   'Downtown Heights',     'Interested',          'Warm', 'u2', NOW() + INTERVAL '2 day', 'Summer Launch 2026',   'Gurugram · 28-40 yrs',  'Luxury Villa Ad 3',    ''),
  ('Raj Malhotra',   '+91 98765-43215', 'raj@example.com',     'Google Ads', 'Green Meadows',        'Visit Completed',     'Hot',  'u4', NOW() - INTERVAL '2 day', 'Plotted Dev Campaign', 'Faridabad · 35-50 yrs', 'Plot Ad 1',            ''),
  ('Sneha Kapoor',   '+91 98765-43216', NULL,                  'Meta Ads',   'Sunset Villas',        'Wrong Number',        'Warm', 'u1', NOW() + INTERVAL '3 day', 'Retargeting Q2',       'Pan India · 28-45 yrs', 'Villa Offer Ad',       ''),
  ('Vikram Nair',    '+91 98765-43217', 'vikram@example.com',  'Referral',   'Green Meadows',        'Booked',              'Hot',  'u3', NOW() + INTERVAL '11 day', NULL,                  NULL,                    NULL,                   'VIP client')
ON CONFLICT DO NOTHING;

-- ============================================================
-- After running this, visit http://localhost:4000/api/test-db
-- You should see 8+ leads returned.
-- ============================================================
