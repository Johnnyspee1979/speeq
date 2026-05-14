# SpeeQ — LinkedIn templates

> Master-files voor consistente LinkedIn-aanwezigheid. Pas alleen tekst aan, niet design.
> Versie 1.0 · 2026-05-13

## Wat zit er

| Bestand | Formaat | Voor |
|---|---|---|
| `banner-1584x396.png` | 1584×396 | LinkedIn-bedrijfsbanner |
| `post-01-testimonial.png` | 1080×1080 | Klantverhaal / citaat |
| `post-02-tip.png` | 1080×1080 | Wkb-tip / kennisartikel |
| `post-03-update.png` | 1080×1080 | Product-update / nieuwe feature |
| `post-04-bts.png` | 1080×1080 | Achter de schermen / waarom |
| `post-05-compare.png` | 1080×1080 | Vergelijking met concurrent |

## Hoe nieuwe post maken

1. Open de juiste `.html` (bijv. `post-02-tip.html`)
2. Wijzig alleen de tekst tussen `<h2 class="tip-title">...</h2>` of `<p class="tip-body">...</p>`
3. Sla op
4. Run: `python3 build.py` (vanuit deze map)
5. Nieuwe PNG staat klaar — upload naar LinkedIn

**Niet doen:** kleuren wijzigen, fonts wijzigen, layout slopen. Dat haalt de consistentie eruit.

## Posting-ritme

Aanbevolen: 2× per week posten, afwisselend uit de 5 categorieën.

| Dag | Type |
|---|---|
| Dinsdag 09:00 | Tip of Achter de schermen |
| Donderdag 09:00 | Klantverhaal of Update |

## Brand-rules

- **Kleur:** navy `#0B2545` + cream `#FAF7F2` + accent `#C9A961`
- **Fonts:** Acumin Pro (heading) + Source Serif 4 (body)
- **Tone:** rustig, no-nonsense, geen hype
- **Niet:** concurrent-bashing, emoji-overload, "revolutionair"

---

*Versie 1.0 · 2026-05-13 · Spee Solutions*
