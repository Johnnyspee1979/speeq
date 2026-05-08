# SpeeQ WKB — Claude project-instructies

## 🎨 Design-tooling (verplicht in deze volgorde)

Wanneer Claude een **nieuwe UI-component, scherm of pagina** maakt of refactort
voor SpeeQ WKB, gebruik tools in deze prioriteit:

### 1️⃣ 21st.dev Magic MCP — STANDAARD voor nieuwe componenten
Tools: `mcp__magic__21st_magic_component_builder`, `_inspiration`, `_refiner`, `logo_search`

**Wanneer gebruiken:**
- Nieuwe button, input, card, modal, dialog, table, form, banner, dropdown, etc.
- Bestaand component opnieuw stylen ("/refine", "/ui", "/21")
- Bedrijfslogo's invoegen (`logo_search`)
- Inspiratie zoeken vóór een implementatie ("/inspiration")

**Werkwijze:**
1. `21st_magic_component_inspiration` — bekijk eerst wat 21st.dev biedt voor de query
2. `21st_magic_component_builder` — genereer component-snippet
3. Snippet aanpassen aan SpeeQ theme-tokens (`frontend/src/theme/theme.ts`):
   - Vervang Tailwind classes door inline styles met `theme.colors.*`, `theme.spacing.*`, `theme.radius.*`
   - Vervang `lucide-react` icons door equivalent (later: native Lucide-migratie)
   - Web-only componenten → wrap in `Platform.OS === 'web'`-guard
4. Animaties: gebruik bestaande Framer Motion-wrappers in `src/components/motion/`
   (`MotionPressable`, `MotionPanel`, `MotionTabIndicator`)

### 2️⃣ UI UX Pro Max skill — voor design-system beslissingen
Pad: `~/.claude/skills/ui-ux-pro-max/`

**Wanneer gebruiken:**
- Kleurpalette, typografie, of stijlrichting bepalen
- WCAG-validatie (contrast, focus, motion)
- Pattern-onderzoek (landing-page, dashboard, real-time, etc.)

**Aanroepen:**
```bash
cd ~/.claude/skills/ui-ux-pro-max
python3 scripts/search.py "<query>" --design-system --stack react-native --project-name "SpeeQ WKB" --format markdown
```

Output altijd opslaan in `docs/Sprint-N-Design-System.md` voor traceerbaarheid.

### 3️⃣ Bestaande SpeeQ-tokens & wrappers — verplicht consumeren

| Bron | Pad | Wanneer |
|---|---|---|
| Theme-tokens | `frontend/src/theme/theme.ts` | Altijd (kleur, spacing, radius, font) |
| Motion-wrappers | `frontend/src/components/motion/` | Hover, tap, panel-transitions |
| Haptic feedback | `frontend/src/hooks/useHaptic.ts` | Confirmaties, status-events |
| Globale CSS | `frontend/web/index.html` + `scripts/postbuild-web.mjs` | Focus, reduced-motion, fonts |

## 🚫 Niet doen
- Geen losstaande HEX-kleuren in component-code (gebruik `theme.colors.*`)
- Geen `setTimeout`-animaties (gebruik Framer Motion)
- Geen emoji's als core UI-icons in nieuwe componenten (Lucide-migratie loopt)
- Geen Tailwind/utility-classes installeren (RN Web ondersteunt het beperkt)
- Geen paars/roze AI-gradients (alleen brand-rood `#A40D2F` + status-kleuren)

## ✅ Pre-merge checklist nieuwe component
- [ ] WCAG AA contrast (4.5:1 body, 3:1 UI-elementen)
- [ ] Touch-target ≥ 44×44 px
- [ ] `:focus-visible` outline zichtbaar
- [ ] Werkt met `prefers-reduced-motion: reduce`
- [ ] Cross-platform getest (web + native via `Platform.OS`)
- [ ] Theme-tokens geconsumeerd (geen hardcoded kleuren/sizes)
- [ ] `npx tsc --noEmit` groen

## 📦 Build & Deploy
```bash
cd frontend
npx tsc --noEmit                                    # TS-check
npx vercel deploy --prod --scope spee-solutions --yes  # productie
```

Productie-alias: https://wkb-snap-sync.vercel.app

## 📚 Sprint-historie
- Sprint 8 — Insert-lock + sync-perf (176× sneller upload)
- Sprint 9 — UI UX Pro Max design-system + Framer Motion + 21st.dev als standaard
