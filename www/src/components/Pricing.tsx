import './Pricing.css';
import { Check } from 'lucide-react';

export default function Pricing() {
  return (
    <section id="pricing" className="pricing-section">
      <div className="container">
        <div className="section-header">
          <h2>Heldere Prijzen, Geen Verrassingen</h2>
          <p>Kies het abonnement dat past bij de schaal van uw projecten.</p>
        </div>

        <div className="pricing-grid">
          <div className="pricing-card">
            <h3 className="plan-name">Basis</h3>
            <div className="plan-price">€299<span>/mnd</span></div>
            <p className="plan-desc">Perfect voor de onafhankelijke aannemer of kleine projecten.</p>
            <ul className="plan-features">
              <li><Check size={18} className="check-icon" /> Tot 5 actieve projecten</li>
              <li><Check size={18} className="check-icon" /> 10 Mobiele app gebruikers</li>
              <li><Check size={18} className="check-icon" /> Basis PDF Rapportages</li>
              <li><Check size={18} className="check-icon" /> Email support</li>
            </ul>
            <button className="btn btn-primary btn-block">Kies Basis</button>
          </div>

          <div className="pricing-card featured">
            <div className="featured-badge">Meest Gekozen</div>
            <h3 className="plan-name">Professional</h3>
            <div className="plan-price">€599<span>/mnd</span></div>
            <p className="plan-desc">Ideaal voor middelgrote bouwbedrijven met eigen kwaliteitsborgers.</p>
            <ul className="plan-features">
              <li><Check size={18} className="check-icon" /> Tot 25 actieve projecten</li>
              <li><Check size={18} className="check-icon" /> Onbeperkt app gebruikers</li>
              <li><Check size={18} className="check-icon" /> KiK & DSO Integraties</li>
              <li><Check size={18} className="check-icon" /> Afas & Exact koppeling</li>
              <li><Check size={18} className="check-icon" /> Prioriteit telefonische support</li>
            </ul>
            <button className="btn btn-primary btn-block">Kies Professional</button>
          </div>

          <div className="pricing-card">
            <h3 className="plan-name">Enterprise</h3>
            <div className="plan-price">Op Maat</div>
            <p className="plan-desc">Voor de grootste spelers die een on-premise of white-label oplossing zoeken.</p>
            <ul className="plan-features">
              <li><Check size={18} className="check-icon" /> Onbeperkte projecten</li>
              <li><Check size={18} className="check-icon" /> Dedicated Private Cloud Database</li>
              <li><Check size={18} className="check-icon" /> Maatwerk ERP integraties</li>
              <li><Check size={18} className="check-icon" /> 24/7 SLA Support</li>
            </ul>
            <button className="btn btn-block">Neem Contact Op</button>
          </div>
        </div>
      </div>
    </section>
  );
}
