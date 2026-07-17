import Sidebar from './components/Sidebar';
import TenantManager from './components/TenantManager';
import './App.css'; // Optional if needed, but we rely on index.css

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {/* Sprint 5 — primaire dashboard. TenantsPage blijft beschikbaar als
            uitgebreidere variant met Supabase-credential velden. */}
        <TenantManager />
      </main>
    </div>
  );
}

export default App;
