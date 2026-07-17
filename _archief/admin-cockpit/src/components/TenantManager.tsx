/**
 * TenantManager — Sprint 5
 *
 * Simpel admin-dashboard voor SpeeQ tenants:
 *  - lijst van alle tenants (GET /api/v1/tenants)
 *  - knop + formulier voor "Nieuwe Klant" (POST /api/v1/tenants)
 *
 * Backend: standaard http://localhost:4100, override via VITE_API_URL.
 */

import React, { useEffect, useState } from 'react';

interface Tenant {
  companyId: string;
  name: string;
  status: string;
  users: number;
  createdAt: string;
  adminEmail?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  provisioningStatus?: 'pending' | 'provisioned';
}

const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4100';

const STATUS_LABEL: Record<string, string> = {
  active: 'Actief',
  suspended: 'Geschorst',
  pending: 'Wachtend',
};

export default function TenantManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants`);
      const data = await res.json();
      if (data?.success) {
        setTenants(Array.isArray(data.data) ? data.data : []);
      } else {
        setError(data?.error ?? 'Onbekende fout bij ophalen.');
      }
    } catch (err: any) {
      setError(`Backend niet bereikbaar: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          adminEmail: adminEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setCompanyName('');
        setAdminEmail('');
        setShowForm(false);
        await fetchTenants();
      } else {
        setError(data?.error ?? 'Aanmaken mislukt.');
      }
    } catch (err: any) {
      setError(`Netwerkfout: ${err?.message ?? err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>SpeeQ Tenant Manager</h1>
          <p style={styles.subtitle}>
            {tenants.length} klant{tenants.length === 1 ? '' : 'en'} ·
            backend: <code style={styles.code}>{API_BASE}</code>
          </p>
        </div>
        <button
          style={styles.btnPrimary}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? '✕ Annuleren' : '+ Nieuwe Klant'}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleCreate} style={styles.form}>
          <h3 style={styles.formTitle}>Nieuwe klant aanmaken</h3>

          <label style={styles.label}>
            <span>Bedrijfsnaam</span>
            <input
              required
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Bijv. Jansen Bouw BV"
              style={styles.input}
              disabled={submitting}
            />
          </label>

          <label style={styles.label}>
            <span>Admin e-mail</span>
            <input
              required
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@jansenbouw.nl"
              style={styles.input}
              disabled={submitting}
            />
          </label>

          <p style={styles.hint}>
            companyId wordt automatisch afgeleid van de bedrijfsnaam (slug).
            Supabase-instance koppel je daarna handmatig — tenant start als
            <strong> &quot;pending&quot;</strong>.
          </p>

          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.btnGhost}
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              Annuleren
            </button>
            <button type="submit" style={styles.btnPrimary} disabled={submitting}>
              {submitting ? 'Aanmaken…' : 'Klant aanmaken'}
            </button>
          </div>
        </form>
      )}

      {error && <div style={styles.errorBox}>⚠ {error}</div>}

      <section style={styles.tableWrap}>
        <h2 style={styles.sectionTitle}>Alle tenants</h2>

        {loading ? (
          <p style={styles.muted}>Laden…</p>
        ) : tenants.length === 0 ? (
          <p style={styles.muted}>Nog geen tenants. Voeg je eerste klant toe.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Bedrijf</th>
                <th style={styles.th}>Company ID</th>
                <th style={styles.th}>Admin e-mail</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Provisioning</th>
                <th style={styles.th}>Users</th>
                <th style={styles.th}>Aangemaakt</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.companyId} style={styles.tr}>
                  <td style={styles.td}><strong>{t.name}</strong></td>
                  <td style={styles.td}><code style={styles.code}>{t.companyId}</code></td>
                  <td style={styles.td}>{t.adminEmail ?? '—'}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.pill,
                      background: t.status === 'active' ? '#10B98122' : '#EF444422',
                      color: t.status === 'active' ? '#10B981' : '#EF4444',
                    }}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.pill,
                      background: t.provisioningStatus === 'provisioned' ? '#3B82F622' : '#F59E0B22',
                      color: t.provisioningStatus === 'provisioned' ? '#3B82F6' : '#F59E0B',
                    }}>
                      {t.provisioningStatus === 'provisioned' ? '☁ gereed' : '⏳ pending'}
                    </span>
                  </td>
                  <td style={styles.td}>{t.users ?? 0}</td>
                  <td style={styles.td}>{t.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ── inline styles (independent of de bestaande TenantsPage CSS) ─────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px 32px',
    color: 'var(--text-main, #fff)',
    fontFamily: 'Outfit, system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  title: { fontSize: 24, fontWeight: 800, marginBottom: 4 },
  subtitle: { color: 'var(--text-muted, #8B9BB4)', fontSize: 13 },
  code: {
    fontFamily: 'SF Mono, Menlo, Consolas, monospace',
    fontSize: 12,
    background: 'rgba(255,255,255,0.06)',
    padding: '1px 6px',
    borderRadius: 4,
  },

  btnPrimary: {
    background: 'var(--accent-primary, #E8500A)',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    color: 'var(--text-muted, #8B9BB4)',
    border: '1px solid var(--border-color, #232D42)',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },

  form: {
    background: 'var(--bg-card, #141A29)',
    border: '1px solid var(--border-color, #232D42)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  formTitle: { fontSize: 16, fontWeight: 800 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 },
  input: {
    background: 'var(--bg-main, #0B0F19)',
    border: '1px solid var(--border-color, #232D42)',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  hint: { color: 'var(--text-muted, #8B9BB4)', fontSize: 12, lineHeight: 1.5 },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },

  errorBox: {
    background: '#EF444422',
    border: '1px solid #EF444466',
    color: '#FCA5A5',
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
  },

  tableWrap: {
    background: 'var(--bg-card, #141A29)',
    border: '1px solid var(--border-color, #232D42)',
    borderRadius: 12,
    padding: 18,
    overflowX: 'auto',
  },
  sectionTitle: { fontSize: 14, fontWeight: 800, marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted, #8B9BB4)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-color, #232D42)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'var(--text-muted, #8B9BB4)',
    fontWeight: 700,
  },
  tr: {},
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' },
  pill: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  muted: { color: 'var(--text-muted, #8B9BB4)', fontSize: 13 },
};
