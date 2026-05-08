import React from 'react';
import Sidebar from './components/Sidebar';
import TenantsPage from './pages/TenantsPage';
import './App.css'; // Optional if needed, but we rely on index.css

function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <TenantsPage />
      </main>
    </div>
  );
}

export default App;
