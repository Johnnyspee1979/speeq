import React from 'react';

export default function Navbar() {
  return (
    <nav>
      <div className="container nav-content">
        <div className="logo">
          <div className="logo-dot"></div>
          Structura Wkb
        </div>
        <div className="nav-links">
          <a href="#features">Functionaliteiten</a>
          <a href="#pricing">Prijzen</a>
          <a href="#contact">Contact</a>
          <a href="http://localhost:5173" className="btn btn-primary" style={{ padding: '8px 20px' }}>Inloggen</a>
        </div>
      </div>
    </nav>
  );
}
