import { LayoutDashboard, Users, ShieldAlert, Settings } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-dot"></div>
          <h2>SpeeQ</h2>
        </div>
        <span className="badge">COCKPIT</span>
      </div>
      
      <nav className="sidebar-nav">
        <a href="#" className="nav-item active">
          <Users size={20} />
          <span>Bedrijven (Tenants)</span>
        </a>
        <a href="#" className="nav-item">
          <LayoutDashboard size={20} />
          <span>Systeem Status</span>
        </a>
        <a href="#" className="nav-item">
          <ShieldAlert size={20} />
          <span>Support & Klachten</span>
        </a>
        <a href="#" className="nav-item">
          <Settings size={20} />
          <span>Instellingen</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">JS</div>
          <div>
            <p className="name">Johnny Spee</p>
            <p className="role">Superadmin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
