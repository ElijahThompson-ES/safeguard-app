import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/hazards — list all hazards, most recent first
export async function GET() {
  const { data, error } = await supabase
    .from('hazards')
    .select('*, scans(image_url, created_at, location)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ hazards: data });
}

// PATCH /api/hazards — update a hazard's status (e.g. mark resolved)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('hazards')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('governance_log').insert({
    event_type: 'hazard_status_changed',
    description: `Hazard "${data.hazard_type}" marked as ${status}`,
    actor: 'user',
  });

  return NextResponse.json({ hazard: data });
}
