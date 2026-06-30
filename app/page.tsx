'use client';

import { useState, useEffect, useRef } from 'react';

type Hazard = {
  id: string;
  hazard_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  osha_code: string | null;
  osha_description: string | null;
  status: 'open' | 'in_review' | 'resolved';
  created_at: string;
  scans: { image_url: string; created_at: string; location: string | null } | null;
};

const severityColor: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'var(--bg-success)', text: 'var(--text-success)', border: 'var(--border-success)' },
  medium: { bg: 'var(--bg-warning)', text: 'var(--text-warning)', border: 'var(--border-warning)' },
  high: { bg: 'var(--bg-danger)', text: 'var(--text-danger)', border: 'var(--border-danger)' },
  critical: { bg: 'var(--bg-danger)', text: 'var(--text-danger)', border: 'var(--border-danger)' },
};

export default function Dashboard() {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadHazards() {
    setLoading(true);
    try {
      const res = await fetch('/api/hazards');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHazards(data.hazards || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHazards();
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setLastResult(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setLastResult(data.result);
      await loadHazards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await fetch('/api/hazards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await loadHazards();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const openCount = hazards.filter((h) => h.status === 'open').length;
  const criticalCount = hazards.filter(
    (h) => h.status === 'open' && (h.severity === 'critical' || h.severity === 'high')
  ).length;
  const totalScans = new Set(hazards.map((h) => h.scans?.created_at)).size;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#185FA5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
            🛡
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>SafeGuard AI</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Compliance Intelligence Platform</div>
          </div>
        </div>
      </div>

      {/* KPIs — real data */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' }}>
        <Kpi label="Open hazards" value={openCount} />
        <Kpi label="Critical/high (open)" value={criticalCount} accent={criticalCount > 0 ? 'var(--text-danger)' : undefined} />
        <Kpi label="Total scans" value={totalScans} />
      </div>

      {/* Upload card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>📷 Upload image for hazard analysis</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading}
          style={{ marginBottom: 10 }}
        />
        {uploading && (
          <div style={{ fontSize: 13, color: 'var(--accent)' }}>
            Analyzing image with Claude… this takes a few seconds
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: 'var(--text-danger)', background: 'var(--bg-danger)', padding: '8px 12px', borderRadius: 6, marginTop: 8 }}>
            {error}
          </div>
        )}
        {lastResult && (
          <div style={{ fontSize: 13, marginTop: 10, padding: '10px 12px', background: 'var(--surface-1)', borderRadius: 6 }}>
            Scan complete — overall risk: <strong>{lastResult.overall_risk}</strong>,{' '}
            {lastResult.hazards.length} hazard(s) detected.
          </div>
        )}
      </div>

      {/* Hazards list — real data from database */}
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>⚠ Detected hazards</div>
        {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>}
        {!loading && hazards.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No hazards yet — upload an image above to run your first scan.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hazards.map((h) => {
            const colors = severityColor[h.severity] || severityColor.low;
            return (
              <div
                key={h.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px',
                  background: 'var(--surface-1)',
                  borderRadius: 8,
                }}
              >
                {h.scans?.image_url && (
                  <img
                    src={h.scans.image_url}
                    alt={h.hazard_type}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{h.hazard_type}</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: colors.bg,
                        color: colors.text,
                        border: `0.5px solid ${colors.border}`,
                      }}
                    >
                      {h.severity}
                    </span>
                    {h.osha_code && (
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {h.osha_code}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {h.description}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['open', 'in_review', 'resolved'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(h.id, s)}
                        style={{
                          fontSize: 11,
                          padding: '3px 10px',
                          borderRadius: 20,
                          border: h.status === s ? '1px solid var(--accent)' : '0.5px solid var(--border)',
                          background: h.status === s ? '#e6f1fb' : 'transparent',
                          color: h.status === s ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: accent || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '18px 20px',
};
