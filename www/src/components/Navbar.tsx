export default function Navbar() {
  return (
    <nav>
      <div className="container nav-content">
        <div className="logo">
          <div className="logo-dot"></div>
          SpeeQ
        </div>
        <div className="nav-links">
          <a href="#features">Functionaliteiten</a>
          <a href="#pricing">Prijzen</a>
          <a href="#contact">Contact</a>
          <a href="https://wkb-snap-sync.vercel.app" className="btn btn-primary" style={{ padding: '8px 20px' }}>Inloggen</a>
        </div>
      </div>
    </nav>
  );
}
