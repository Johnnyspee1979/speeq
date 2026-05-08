import React from 'react';
import './Hero.css';

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero-content">
        <h1 className="hero-title">
          Kwaliteitsborging, <br />
          <span className="text-accent">Zonder de Complexiteit.</span>
        </h1>
        <p className="hero-subtitle">
          Structura Wkb is dé premium SaaS-oplossing voor bouwbedrijven.
          Koppel direct met Afas, Exact, en het DSO. Voldoe vandaag nog
          aan de Wet kwaliteitsborging voor het bouwen.
        </p>
        <div className="hero-cta">
          <a href="#contact" className="btn btn-primary">Vraag een Demo Aan</a>
          <a href="#features" className="btn">Bekijk de Features</a>
        </div>
      </div>
    </section>
  );
}
