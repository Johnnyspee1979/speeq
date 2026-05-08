import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Pricing />
      </main>
      <footer style={{ textAlign: 'center', padding: '60px 0', borderTop: '1px solid var(--border-light)', marginTop: '80px', color: 'var(--text-muted)' }}>
        <p>&copy; 2026 SpeeSolutions. Alle rechten voorbehouden.</p>
      </footer>
    </>
  );
}

export default App;
