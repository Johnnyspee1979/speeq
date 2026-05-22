# SpeeQ Design Systeem — Volledige tool sales-klaar maken

**Doel:** Hele tool één rustige, premium uitstraling geven. Geen ad-hoc fixes per scherm meer.
**Aanpak:** Eerst globale design-tokens vastleggen → daarna elk scherm consistent aanpassen.

---

## Globale principes (gelden voor ÉLK scherm)

| Regel | Wat het betekent |
|---|---|
| **1 primary kleur per scherm** | Maximaal 1 groene/accent-knop in beeld. Rest is secundair (transparant + tekst-kleur). |
| **Rood = fout, nooit actie** | Rode knoppen alleen bij errors, afkeuren, verwijderen. Niet voor "open" of "details". |
| **Verberg developer-info** | GPS-coordinaten, SHA-hashes, EXIF, AI-vertrouwen-percentages, technische IDs: weg uit standaard view. Alleen in detail-modal. |
| **Empty states zijn vriendelijk** | Geen 5x "0" tellers. Bij leeg = één centrale uitleg met icoon. |
| **Italic serif voor titles** | Pagina-titels in `Georgia / Playfair Display, italic, weight 500`. Subtitles regulier. |
| **Warm palette boven koud** | Borders en achtergronden: `rgba(120,90,70,0.08-0.15)` ipv `#e5e7eb`. Cream surfaces ipv puur wit. |
| **Pillen voor status, niet voor acties** | Status-badges (uitgenodigd, actief, openstaand) = pill. Knoppen = afgeronde rechthoek. |
| **Header met logo + branding** | Elk hoofdscherm toont logo (of initial-circle) naast company-naam. Niet alleen tekst. |

---

## Design tokens — gebruik overal

Maak nieuw bestand `frontend/src/theme/designTokens.ts`:

```ts
export const tokens = {
  // Kleuren
  primary:        '#059669',           // groen — voor PRIMARY cta only
  primarySoft:    'rgba(5,150,105,0.1)',
  danger:         '#dc2626',           // rood — alleen errors/verwijderen
  warning:        '#9a6c1c',
  warningSoft:    'rgba(154,108,28,0.12)',

  surfaceWarm:    'rgba(250,245,240,0.5)',
  borderWarm:     'rgba(120,90,70,0.15)',
  borderWarmSoft: 'rgba(120,90,70,0.08)',
  hoverWarm:      'rgba(120,90,70,0.06)',

  // Radius
  radiusSm: 8,
  radiusMd: 10,
  radiusLg: 14,
  radiusPill: 999,

  // Spacing
  s1: 4,  s2: 8,  s3: 12,  s4: 16,  s5: 20,  s6: 24,  s8: 32,

  // Type
  fontSerif: 'Georgia, "Playfair Display", serif',
  fontSans:  'system-ui, -apple-system, sans-serif',
};
```

Importeer in elk scherm dat je aanpakt.

---

## Herbruikbare componenten — eerst bouwen

Maak 3 kleine componenten die over de hele tool gebruikt worden:

### `frontend/src/components/ui/PageHeader.tsx`
```tsx
export function PageHeader({ eyebrow, title, subtitle }: {
  eyebrow?: string; title: string; subtitle?: string;
}) {
  // eyebrow caps (10px, letterSpacing 3, accent)
  // title in serif italic (36px, weight 500)
  // subtitle regulier (14px, secondary)
}
```

### `frontend/src/components/ui/PrimaryButton.tsx` + `SecondaryButton.tsx`
- Primary: groen (#059669), wit text, radius 10
- Secondary: transparant, 1px border `borderWarm`, primary tekst-kleur

### `frontend/src/components/ui/StatusPill.tsx`
- Variants: `active` (groen soft), `pending` (warning soft), `error` (rood soft)
- Klein, rond, hoofdletters niet, letterSpacing 0.3

Deze 3 + de design-tokens vervangen 80% van de inconsistenties.

---

## Schermen — volgorde van aanpak

Pak ze in deze volgorde aan (impact-eerst):

### Prioriteit 1 — visitekaart-schermen (deze zien klanten)

| Scherm | Bestand | Belangrijkste fix |
|---|---|---|
| Kwaliteitsborger Dashboard | `screens/WerkvoorbereiderDashboard.tsx` | Zie `REDESIGN_KWALITEITSBORGER.md` |
| Mijn werkruimte | `screens/MijnWerkruimteScreen.tsx` (of equivalent) | Empty-state, logo header, max 1 primary CTA |
| Dossier overzicht | `screens/DossierScreen.tsx` | Premium card-layout, geen dev-info |

### Prioriteit 2 — admin-schermen (jij + keyusers)

| Scherm | Bestand | Belangrijkste fix |
|---|---|---|
| Team Beheer | `screens/TeamBeheerScreen.tsx` | Zie `REDESIGN_TEAMBEHEER.md` |
| Modules | `screens/TenantFeaturesScreen.tsx` | Al rustig, alleen serif-title toevoegen |
| Bedrijfsbranding | `screens/BrandingScreen.tsx` | Hetzelfde patroon als Modules |

### Prioriteit 3 — minder zichtbare schermen

| Scherm | Belangrijkste fix |
|---|---|
| Projectoverzicht | Premium card-grid |
| GPS-kaart | Map met rustige overlay, weg met technische coords-popup |
| Opleveringslijst | Tabel met serieus uiterlijk |
| Opdrachtgever / DSO / Voorinstellingen / Informatie | Empty-state + serif-title |
| Maker-dashboard | Al ok, alleen serif-title toevoegen |

---

## Algemeen receptenboek — voor élk scherm

Wat er op elke pagina moet gebeuren:

1. **Header vervangen** door `<PageHeader>` met serif-title
2. **Action-row** maken: max 1 primary, rest secundair
3. **Lege staat** vangen met empty-state component (icoon + 1 regel uitleg)
4. **Cards** met radius `tokens.radiusLg`, borderColor `tokens.borderWarm`, padding `tokens.s5`
5. **Buttons** vervangen door `<PrimaryButton>` / `<SecondaryButton>`
6. **Status badges** vervangen door `<StatusPill>`
7. **Dev-info verbergen**: zoek naar `GPS:`, `SHA`, `EXIF`, `AI-vertrouwen`, `coördinaten` → weg / naar detail-modal
8. **Kleur-audit**: tel alle groene/rode elementen → ga terug naar 1 primary + status-pills

---

## Volgorde voor verse sessie

```bash
cd "/Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq"
```

**Prompt 1 (fundament):**
> Lees `DESIGN_SYSTEM_GLOBAL.md` en maak:
> 1. `frontend/src/theme/designTokens.ts`
> 2. `frontend/src/components/ui/PageHeader.tsx`
> 3. `frontend/src/components/ui/PrimaryButton.tsx`
> 4. `frontend/src/components/ui/SecondaryButton.tsx`
> 5. `frontend/src/components/ui/StatusPill.tsx`
> 6. `frontend/src/components/ui/EmptyState.tsx`
>
> Daarna `npx tsc --noEmit` om te bevestigen dat alles bouwt.

**Prompt 2 (eerste scherm — hoofdpagina):**
> Voer `REDESIGN_KWALITEITSBORGER.md` uit. Gebruik de nieuwe UI-componenten waar mogelijk.

**Prompt 3 (team beheer):**
> Voer `REDESIGN_TEAMBEHEER.md` uit. Gebruik de nieuwe UI-componenten.

**Prompt 4 (rest van de tool):**
> Loop door deze schermen en pas het receptenboek toe uit `DESIGN_SYSTEM_GLOBAL.md`:
> - Mijn werkruimte
> - Dossier
> - Modules
> - Bedrijfsbranding
> - Projectoverzicht
> - GPS-kaart
> - Opleveringslijst
> - Opdrachtgever
> - DSO
> - Voorinstellingen
> - Informatie
> - Maker-dashboard
>
> Per scherm: serif-title, max 1 primary CTA, empty-states, dev-info verbergen, warme borders/cards.
> Behoud alle logica. Verander alleen render + styles.

**Deploy:**
```bash
cd frontend
npx vercel --prod --yes
npx vercel alias set <new-url> speeq-wkb-tool.vercel.app
```

---

## Verwachting

- **Prompt 1:** ~15 min
- **Prompt 2:** ~30 min
- **Prompt 3:** ~45 min
- **Prompt 4:** ~2 uur (12 schermen × ~10 min)
- **Deploy:** 5 min

Totaal: een halve werkdag voor een tool die er pro uitziet over de hele linie.

---

## Wat het verschil gaat zijn

**Vandaag:** "leuke prototype, kan ik dat kopen?" → klant twijfelt
**Na deze pass:** "wow, dit oogt als een product van een bedrijf" → klant vraagt prijs

---

*Versie 1.0 · 19-05-2026 · Voor verse sessie · Johnny voert plan uit.*
