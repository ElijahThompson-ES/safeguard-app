import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This client is safe to use in both the browser and server code.
// It uses the public "anon" key, which only has the permissions you
// granted via Row Level Security policies in schema.sql.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Hazard = {
  id: string;
  scan_id: string;
  created_at: string;
  hazard_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  osha_code: string | null;
  osha_description: string | null;
  status: 'open' | 'in_review' | 'resolved';
};

export type Scan = {
  id: string;
  created_at: string;
  image_url: string;
  location: string | null;
  overall_risk: string;
  raw_ai_response: any;
  notes: string | null;
};
