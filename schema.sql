-- SafeGuard AI database schema
-- Run this once in Supabase: Project > SQL Editor > paste this > Run

-- Stores every uploaded image and its AI analysis result
create table scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  image_url text not null,
  location text,
  overall_risk text,              -- 'low' | 'medium' | 'high' | 'critical'
  raw_ai_response jsonb,          -- full structured response from Claude
  notes text
);

-- One row per hazard detected within a scan (a single photo can have many)
create table hazards (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scans(id) on delete cascade,
  created_at timestamp with time zone default now(),
  hazard_type text not null,       -- e.g. "Missing PPE"
  description text,
  severity text not null,          -- 'low' | 'medium' | 'high' | 'critical'
  osha_code text,                  -- e.g. "1910.132"
  osha_description text,
  status text default 'open',      -- 'open' | 'in_review' | 'resolved'
  bounding_box jsonb               -- optional: {x, y, width, height} if you add localization later
);

-- Reference table: OSHA standards your app knows about
create table osha_standards (
  code text primary key,
  title text not null,
  description text,
  category text
);

-- Seed it with common standards relevant to general workplace hazards
insert into osha_standards (code, title, description, category) values
('1910.132', 'Personal Protective Equipment - General Requirements', 'Requires PPE where hazards exist that could cause injury through contact, absorption, or other exposure.', 'PPE'),
('1910.147', 'The Control of Hazardous Energy (Lockout/Tagout)', 'Covers servicing and maintenance of machines where unexpected energization could cause injury.', 'Electrical/Mechanical'),
('1910.157', 'Portable Fire Extinguishers', 'Requirements for placement, maintenance, and accessibility of fire extinguishers.', 'Fire Safety'),
('1910.303', 'Electrical - General Requirements', 'General requirements for electrical conductors and equipment.', 'Electrical'),
('1910.22', 'Walking-Working Surfaces - General Requirements', 'Requires surfaces be kept clean, dry, and free of hazards like clutter and spills.', 'Housekeeping'),
('1910.1200', 'Hazard Communication Standard', 'Requires labeling and safety data sheets for hazardous chemicals.', 'Chemical'),
('1926.502', 'Fall Protection Systems Criteria', 'Requirements for guardrails, safety nets, and personal fall arrest systems.', 'Fall Protection'),
('1910.37', 'Maintenance, Safeguards, and Operational Features for Exit Routes', 'Requires exit routes be kept clear and unobstructed.', 'Egress');

-- Simple audit/governance log
create table governance_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  event_type text not null,    -- e.g. 'scan_completed', 'hazard_resolved'
  description text,
  actor text default 'system'
);

-- Allow public read/write for now (since there's no auth yet).
-- IMPORTANT: lock this down before handling real sensitive data —
-- see the "Adding login" section in README.
alter table scans enable row level security;
alter table hazards enable row level security;
alter table osha_standards enable row level security;
alter table governance_log enable row level security;

create policy "public read scans" on scans for select using (true);
create policy "public insert scans" on scans for insert with check (true);
create policy "public read hazards" on hazards for select using (true);
create policy "public insert hazards" on hazards for insert with check (true);
create policy "public update hazards" on hazards for update using (true);
create policy "public read osha" on osha_standards for select using (true);
create policy "public read governance" on governance_log for select using (true);
create policy "public insert governance" on governance_log for insert with check (true);
