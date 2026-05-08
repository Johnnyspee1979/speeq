import { MoreVertical, Database, Users as UsersIcon, CheckCircle2 } from 'lucide-react';
import './TenantCard.css';

interface TenantProps {
  tenant: {
    id: string;
    name: string;
    status: string;
    users: number;
    createdAt: string;
  }
}

export default function TenantCard({ tenant }: TenantProps) {
  return (
    <div className="tenant-card glass-panel">
      <div className="card-header">
        <div className="tenant-title">
          <div className="status-indicator active"></div>
          <h3>{tenant.name}</h3>
        </div>
        <button className="icon-btn">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="tenant-id">ID: <span>{tenant.id}</span></div>

      <div className="card-metrics">
        <div className="metric">
          <UsersIcon size={16} />
          <span>{tenant.users} Actieve app gebruikers</span>
        </div>
        <div className="metric">
          <Database size={16} />
          <span>Supabase Cloud Gekoppeld</span>
        </div>
        <div className="metric">
          <CheckCircle2 size={16} className="success-icon" />
          <span>Wkb Conform</span>
        </div>
      </div>

      <div className="card-footer">
        <span className="date">Klant sinds {tenant.createdAt}</span>
        <button className="btn btn-ghost btn-sm">Beheren</button>
      </div>
    </div>
  );
}
