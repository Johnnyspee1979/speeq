import React, { useState, useEffect } from 'react';
import TenantCard from '../components/TenantCard';
import { X } from 'lucide-react';
import './TenantsPage.css';

interface Tenant {
  companyId: string;
  name: string;
  status: string;
  users: number;
  createdAt: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    companyId: '',
    supabaseUrl: '',
    supabaseAnonKey: ''
  });

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4100/api/v1/tenants');
      const data = await res.json();
      if (data.success) {
        setTenants(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch tenants', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4100/api/v1/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setFormData({ name: '', companyId: '', supabaseUrl: '', supabaseAnonKey: '' });
        fetchTenants();
      } else {
        alert('Fout bij aanmaken: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Netwerkfout');
    }
  };

  return (
    <div className="tenants-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Bedrijven (Tenants)</h1>
          <p className="page-subtitle">Beheer de actieve Wkb licenties en database connecties.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          + Nieuwe Klant Aanmaken
        </button>
      </header>

      <div className="stats-row">
        <div className="stat-card glass-panel">
          <h3>Actieve Licenties</h3>
          <p className="stat-value">{tenants.filter(t => t.status === 'active').length}</p>
        </div>
        <div className="stat-card glass-panel">
          <h3>Totaal Gebruikers</h3>
          <p className="stat-value">{tenants.reduce((acc, t) => acc + (t.users || 0), 0)}</p>
        </div>
        <div className="stat-card glass-panel warning">
          <h3>Geschorst</h3>
          <p className="stat-value">{tenants.filter(t => t.status === 'suspended').length}</p>
        </div>
      </div>

      {loading ? (
        <p>Laden...</p>
      ) : (
        <div className="tenants-grid">
          {tenants.map(tenant => (
            // Adapt to the props expected by TenantCard
            <TenantCard key={tenant.companyId} tenant={{
              id: tenant.companyId,
              name: tenant.name,
              status: tenant.status,
              users: tenant.users,
              createdAt: tenant.createdAt
            }} />
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>Nieuwe Klant Aanmaken</h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTenant} className="tenant-form">
              <div className="form-group">
                <label>Bedrijfsnaam</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Vb. Jansen Bouw BV" />
              </div>
              <div className="form-group">
                <label>Bedrijfs-ID (Unieke loginnaam)</label>
                <input required type="text" value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})} placeholder="Vb. jansenbouw" />
              </div>
              <div className="form-group">
                <label>Supabase URL</label>
                <input required type="text" value={formData.supabaseUrl} onChange={e => setFormData({...formData, supabaseUrl: e.target.value})} placeholder="https://xxx.supabase.co" />
              </div>
              <div className="form-group">
                <label>Supabase Anon Key</label>
                <input required type="text" value={formData.supabaseAnonKey} onChange={e => setFormData({...formData, supabaseAnonKey: e.target.value})} placeholder="eyJ..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Annuleren</button>
                <button type="submit" className="btn">Klant Aanmaken</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
