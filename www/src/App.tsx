import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';

function Contact() {
  return (
    <section id="contact" style={{
      padding: '100px 0',
      background: '#1C2331',
      marginTop: '80px',
    }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#fff', fontSize: '2.2rem', marginBottom: '16px' }}>
          Klaar om te starten?
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '1.1rem', maxWidth: '520px', margin: '0 auto 40px' }}>
          Vraag een vrijblijvende demo aan. Wij laten zien hoe Structura WKB werkt voor jouw bouwprojecten.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="mailto:info@speesolutions.nl?subject=Demo aanvraag Structura WKB"
            className="btn btn-primary"
          >
            Demo Aanvragen
          </a>
          <a
            href="https://wkb-snap-sync.vercel.app"
            className="btn"
            style={{ borderColor: '#ffffff40', background: 'transparent', color: '#fff' }}
          >
            Direct Proberen
          </a>
        </div>
        <p style={{ color: '#6B7280', marginTop: '40px', fontSize: '0.9rem' }}>
          📧 info@speesolutions.nl &nbsp;|&nbsp; 🌐 speesolutions.nl
        </p>
      </div>
    </section>
  );
}

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <Contact />
      </main>
      <footer style={{
        textAlign: 'center',
        padding: '32px 0',
        borderTop: '1px solid var(--border-light)',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}>
        <p>
          &copy; 2026 Spee Solutions &nbsp;·&nbsp;{' '}
          <a href="https://wkb-snap-sync.vercel.app/privacy" style={{ color: 'var(--text-muted)' }}>
            Privacybeleid
          </a>
        </p>
      </footer>
    </>
  );
}

export default App;
