import { ShieldCheck, CloudLightning, Smartphone, Server } from 'lucide-react';
import './Features.css';

export default function Features() {
  const features = [
    {
      title: 'B2B Privacy (Multi-Tenant)',
      description: 'Elke klant krijgt een fysiek geïsoleerde database via de SpeeQ Master Node. Jouw bedrijfsgeheimen blijven altijd veilig.',
      icon: <Server size={32} className="feature-icon" />
    },
    {
      title: 'Mobiele App & Foto Bewijs',
      description: 'De uitvoerder kan met één klik foto\'s toevoegen aan de elementen op de bouwtekening, direct in de Structura Wkb app.',
      icon: <Smartphone size={32} className="feature-icon" />
    },
    {
      title: 'Naadloze ERP Integraties',
      description: 'Koppel moeiteloos met Afas, Exact Online en stuur automatisch documenten naar het DSO en KiK.',
      icon: <CloudLightning size={32} className="feature-icon" />
    },
    {
      title: '100% Wkb Conform',
      description: 'Genereer automatisch de vereiste rapportages (Borgingsplan & Dossier Bevoegd Gezag) in PDF of XML formaat.',
      icon: <ShieldCheck size={32} className="feature-icon" />
    }
  ];

  return (
    <section id="features" className="features-section">
      <div className="container">
        <div className="section-header">
          <h2>Ontworpen voor de Moderne Aannemer</h2>
          <p>Vergeet complexe systemen. Structura Wkb combineert Enterprise kracht met een interface die iedereen begrijpt.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div className="feature-card" key={i}>
              <div className="icon-wrapper">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
