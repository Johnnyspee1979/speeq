# Sprint 9 — Design System (UI UX Pro Max)

> **Bron:** `nextlevelbuilder/ui-ux-pro-max-skill` v2.5.0 (geïnstalleerd in `~/.claude/skills/ui-ux-pro-max/`)
> **Query:** `construction compliance saas mobile dashboard --design-system --stack react-native`
> **Status:** Foundation toegepast in `frontend/src/theme/theme.ts` + `frontend/web/index.html`

## Pattern — Real-Time / Operations Landing
- Conversion focus: ops/security/iot products, demo of sandbox link, trust signals
- CTA placement: primary CTA in nav + na metrics
- Color strategy: dark of neutral, status-kleuren (groen/amber/rood), data-dense maar scanbaar
- Sections: Hero (product + live preview/status) → Key metrics → How it works → CTA

## Style — Exaggerated Minimalism
- Bold minimalism, oversized typography, high contrast, negative space
- Mode-support: Light ✓ Full / Dark ✓ Full
- Performance: ⚡ Excellent | Accessibility: ✓ WCAG AA
- Best for: dashboards, agency landing pages, statement design
- Key effects: `font-size: clamp(3rem, 10vw, 12rem)` voor headers, `font-weight: 900`, `letter-spacing: -0.05em`, massive whitespace

## Colors (toegepast in `theme.ts`)
| Role | Hex | Notitie |
|---|---|---|
| Primary background | `#020617` | slate-950 |
| Surface | `#0F172A` | slate-900 |
| Surface alt | `#1E293B` | slate-800 |
| Text primary | `#F8FAFC` | slate-50 |
| Text secondary | `#94A3B8` | slate-400 — **WCAG AA fix** (was 3.4:1, nu 5.4:1) |
| Border | `rgba(148,163,184,0.18)` | subtle glass |
| **Accent (BRAND)** | `#A40D2F` | Spee Solutions Rood — niet aangeraakt |
| Success | `#22C55E` | green-500 — heller bij zonlicht |
| Warning | `#F59E0B` | amber-500 |
| Danger | `#EF4444` | red-500 |

## Typography (Google Fonts geladen in `index.html`)
- **Body:** `Fira Sans` (300/400/500/600/700/900)
- **Heading + Mono:** `Fira Code` (400/500/600/700)
- Mood: dashboard, data, analytics, code, technical, precise
- CDN: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700;900&display=swap">`

## UX Guidelines (toegepast)
| Issue | Severity | Toegepast in |
|---|---|---|
| Touch target ≥44×44px | High | Bestaand (48×48 in stylesheet) |
| Touch spacing ≥8px gap | Medium | Bestaand (theme.spacing.sm) |
| Tap delay killen | Medium | `touch-action: manipulation` op `*` |
| Focus-visible voor keyboard | Critical | `:focus-visible` outline 2px brand-rood |
| Haptic feedback voor confirmations | Low | `useHaptic` hook (Vibration API + expo-haptics) |
| `prefers-reduced-motion` | Critical | Globale CSS-rule die alle transitions naar 0.01ms zet |

## Anti-patterns (vermijden)
- 2D-only layouts → **fix:** depth via `theme.shadow.{sm,md,lg}`
- Poor image quality → **fix:** asset upgrade (volgende sprint)
- AI purple/pink gradients → **fix:** geen gradients met paars/roze, alleen brand-rood + status

## Pre-delivery checklist
- [x] No emoji as core UI icons (volgende sprint: Lucide migratie — emoji blijven nu in tab-labels)
- [x] cursor-pointer op clickables (globale CSS in `index.html`)
- [x] Hover states 150-300ms (Framer Motion-defaults)
- [x] Light mode contrast 4.5:1 minimum (lightTheme textSecondary `#475569` = 7.5:1)
- [x] Focus states keyboard-nav zichtbaar (`:focus-visible` outline)
- [x] `prefers-reduced-motion` respect (CSS + Framer Motion's auto-detect)
- [ ] Responsive breakpoints 375/768/1024/1440 — nog te valideren

## Hoe regenereren
```bash
cd ~/.claude/skills/ui-ux-pro-max
python3 scripts/search.py "<query>" --design-system --stack react-native --project-name "SpeeQ WKB" --format markdown
# Andere domeinen: --domain {style,color,chart,landing,product,ux,typography,icons,react,web,google-fonts}
```

## 🎨 Standaard design-tool: 21st.dev Magic MCP

**Per Sprint 9** is **21st.dev** (Magic MCP) de **standaard tool** voor het bouwen
van nieuwe UI-componenten in SpeeQ WKB. Zie `CLAUDE.md` (project-root) voor de
volledige tool-prioriteit.

**Beschikbare 21st.dev tools:**
| Tool | Wanneer |
|---|---|
| `21st_magic_component_inspiration` | Vóór implementatie, zien wat 21st.dev biedt |
| `21st_magic_component_builder` | Snippet genereren voor button, card, modal, etc. |
| `21st_magic_component_refiner` | Bestaand component opnieuw stylen |
| `logo_search` | Bedrijfslogo's invoegen (TSX/JSX/SVG) |

**Werkwijze (verplicht):**
1. Inspiratie ophalen via `21st_magic_component_inspiration`
2. Snippet genereren via `21st_magic_component_builder`
3. **Aanpassen aan SpeeQ-theme** — Tailwind classes vervangen door:
   - `theme.colors.*` voor kleuren
   - `theme.spacing.*` voor padding/margin
   - `theme.radius.*` voor border-radius
   - Framer Motion wrappers (`MotionPressable`, `MotionPanel`) voor animaties
4. Web-only? → wrap in `Platform.OS === 'web'`
5. Pre-merge checklist in `CLAUDE.md` afvinken

**Tool-stack (in volgorde van prioriteit):**
```
1. 21st.dev Magic MCP        → nieuwe componenten
2. UI UX Pro Max skill       → design-system beslissingen
3. SpeeQ theme + motion lib  → altijd consumeren
```

## Roadmap (volgende passes)
1. **Lucide-migratie** — emoji → SVG-icons in tab-labels, action-buttons (mogelijk via 21st.dev `logo_search`)
2. **Bento-grid Werkvoorbereider Dashboard** — overview-tab herstructureren naar bento-layout (21st.dev: `bento grid dashboard`)
3. **Hero op DSO-tab** — live status van mTLS-verbinding als hero-section (21st.dev: `status hero realtime`)
4. **Skeleton-loaders** voor evidence-grid (200ms after paint, niet spinner) (21st.dev: `skeleton card grid`)
5. **Per-stack RN guidelines** — `python3 search.py "list virtualization" --stack react-native`
