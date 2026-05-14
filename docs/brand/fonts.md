# SpeeQ — Font keuze

> Vastgelegd 2026-05-13. Bij twijfel: gebruik deze fonts. Niet improviseren.

## De keuze

| Rol | Font | Hoe te gebruiken |
|---|---|---|
| **Heading** | Acumin Pro Medium | Alle h1-h4, knop-tekst, navigatie |
| **Body** | Source Serif 4 Regular | Alle paragrafen, lijsten, tabel-content |
| **Italic accent** | Source Serif 4 Italic | Quotes, eyebrows, subtitels, brief-formele zinnen |
| **Mono (code)** | SF Mono / Menlo | Codeblokken, technische identifiers |

## Waarom

- **Acumin Pro Medium** = clean sans, premium uitstraling, prima leesbaar op alle formaten. Geen tech-startup-vibe.
- **Source Serif 4 Regular** = warm serif, legal-friendly, leest fijn op papier én scherm. Open-source dus altijd te gebruiken.
- Combinatie sans-heading + serif-body voelt premium maar niet stoffig.
- Italic serif accents geven Floema-DNA, past bij Johnny's voorkeur ("italic serif accents voelen premium").

## Waar zit het al

- **Adobe Fonts** (gratis met Photography Plan) → activeren in Creative Cloud app
- **Google Fonts** (gratis voor web) → Source Serif 4 staat al op fonts.google.com
- **Acumin Pro** is Adobe-exclusief, voor web gebruiken we de Adobe Fonts CDN

## Implementatie

### Web (frontend/src/styles/fonts.css)

```css
@import url('https://use.typekit.net/[kit-id].css');  /* Acumin Pro via Adobe Fonts kit */

@font-face {
  font-family: 'Source Serif 4';
  src: url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap');
}

:root {
  --font-heading: 'Acumin Pro', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif;
  --font-mono: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;
}

body { font-family: var(--font-body); }
h1, h2, h3, h4 { font-family: var(--font-heading); }
em { font-family: var(--font-body); font-style: italic; }
code, pre { font-family: var(--font-mono); }
```

### PDF (al actief in docs/juridisch/pdf/style.css)

Zie regel 17-19 van `style.css`.

### Mobiel (frontend/src — React Native)

Op iOS/Android fallback: `Source Serif Pro` + system sans. Custom font-loading via Expo `useFonts`.

## Beslissingsregel

Bij twijfel of een ander font "ook leuk zou zijn" → **nee.** Niet wisselen. Consistentie wint van variatie.

---

*Versie 1.0 · 2026-05-13 · Spee Solutions*
