import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeImageForHazards } from '@/lib/hazard-detection';

// Server-side Supabase client (uses anon key, same as client — fine since
// RLS policies allow public insert for this MVP)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const location = (formData.get('location') as string) || null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG, or WebP.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // 1. Upload the image to Supabase Storage so we have a permanent URL
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from('hazard-images')
      .upload(fileName, buffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload image: ' + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('hazard-images')
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // 2. Send the image to Claude for hazard analysis
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
    const result = await analyzeImageForHazards(base64, mediaType);

    // 3. Save the scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        image_url: imageUrl,
        location,
        overall_risk: result.overall_risk,
        raw_ai_response: result,
      })
      .select()
      .single();

    if (scanError) {
      return NextResponse.json(
        { error: 'Failed to save scan: ' + scanError.message },
        { status: 500 }
      );
    }

    // 4. Save each detected hazard, linked to this scan
    if (result.hazards.length > 0) {
      const hazardRows = result.hazards.map((h) => ({
        scan_id: scan.id,
        hazard_type: h.hazard_type,
        description: h.description,
        severity: h.severity,
        osha_code: h.osha_code,
        osha_description: h.osha_description,
        status: 'open',
      }));

      const { error: hazardError } = await supabase
        .from('hazards')
        .insert(hazardRows);

      if (hazardError) {
        return NextResponse.json(
          { error: 'Failed to save hazards: ' + hazardError.message },
          { status: 500 }
        );
      }
    }

    // 5. Log it in the governance trail
    await supabase.from('governance_log').insert({
      event_type: 'scan_completed',
      description: `Scan completed: ${result.hazards.length} hazard(s) found, risk level ${result.overall_risk}`,
      actor: 'hazard-scanner-agent',
    });

    return NextResponse.json({ scan, result });
  } catch (err: any) {
    console.error('Analyze error:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
