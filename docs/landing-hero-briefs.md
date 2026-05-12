# Landing Hero — Design Briefs

> **Doel van dit document:** twee herbruikbare design briefs (desktop + mobiel) voor de SpeeQ WKB Tool landing page hero-video. Geschreven als instructie aan Claude — plak een brief terug in de chat samen met de video en Claude voert 'm in één keer uit.

---

## Inhoudsopgave

1. [Desktop Hero Brief](#desktop-hero-brief) — voor laptops/desktops ≥ 1024px
2. [Mobile Hero Brief](#mobile-hero-brief) — voor telefoons < 1024px
3. [Hoe gebruik je deze briefs](#hoe-gebruik-je-deze-briefs)

---

<a id="desktop-hero-brief"></a>

# 📋 DESIGN BRIEF — Desktop Hero Video op Landing Page

## 🎯 Doel
Een high-end, cinematic landing page voor SpeeQ WKB Tool die bij de eerste seconde laat zien: *"Spee Solutions kan alles aan op design-niveau."* De video moet **fullscreen op desktop/laptop** spelen, en de marketing-tekst (headline + sub + CTA) wordt **bovenop de video geprojecteerd** — maar de tekst en het logo in de video mogen elkaar **nooit overlappen**.

---

## 🖥️ Scope
- **Alleen voor desktop / laptop** (viewport breedte ≥ 1024px)
- **Niet voor mobiel** — daar is een aparte brief
- De video is een aparte asset in `frontend/src/assets/landing-hero-desktop.mp4`
- **⏱️ Minimale duur: 8 seconden** — korter mag NIET. Bezoeker moet voldoende tijd hebben om de cinematic indruk te laten landen.

---

## 🎬 Hoe de video gepresenteerd wordt

**Layout:** edge-to-edge fullscreen hero
- Video vult **100% van de viewport-breedte** (`width: 100vw`)
- Hoogte: **minimaal 85vh, maximaal 100vh**
- `object-fit: cover` zodat 'ie altijd het hele blok vult zonder zwarte balken
- Geen rand, geen schaduw, geen `border-radius` op desktop
- Geen `<header>` of `<nav>` erboven — pure cinematic opening
- `autoplay`, `muted`, `playsinline`
- **`loop: false`** — speelt 1× af, freezet op laatste frame
- `preload="auto"`

**Achtergrond-naadloosheid:**
- Onder de video begint dezelfde `#F8FAFC` als de rest van de pagina
- Subtiele 24px fade onderaan voor zachte overgang

---

## ✍️ Hoe de tekst op de video komt

**Belangrijkste regel:**
> ❗ De tekst mag **NOOIT** over het SpeeQ-logo in de video heen vallen.

**Concrete oplossing voor desktop:**
1. Tekst in **linker-kolom** (52% van scherm-breedte), verticaal gecentreerd
2. Subtiele **vertical gradient** alleen aan linkerzijde (27% opacity max), fade-out richting midden
3. Logo blijft volledig vrij in het midden + rechter zone van de video
4. Headline → wit `#FFFFFF` met `text-shadow: 0 2px 28px rgba(0,0,0,0.55)`
5. Sub-tekst → off-white `rgba(255,255,255,0.95)` met lichtere shadow
6. CTA-knop → SpeeQ-groen `#7CB94B`, ronding `12px`, schaduw voor diepte
7. Eyebrow caps, klein, witte tekst met subtiele shadow

---

## 📝 Tekst-content

| Element | Tekst |
|---|---|
| Eyebrow | `SPEEQ WKB TOOL` |
| Headline (54px) | `Wkb-dossier in één foto.` |
| Sub (17px) | `De vakman maakt een foto, SpeeQ doet de rest — AI-validatie, GPS-koppeling, dossier-opbouw. Geen Excel-lijstjes meer.` |
| Primary CTA | `Open de tool →` |
| Hint | `Je hebt een toegangscode nodig — vraag deze aan bij Spee Solutions.` |

---

## 📱 Wat er gebeurt op mobiel
Desktop-video wordt **niet ingeladen** (te zwaar, verkeerde aspect ratio). Mobiel heeft eigen mobile hero (zie [Mobile Hero Brief](#mobile-hero-brief)).

Detectie via `Platform.OS === 'web'` + `Dimensions.get('window').width >= 1024`.

---

## 🛠️ Implementatie-stappen voor Claude

1. **Eerst checken: duurt de video ≥ 8 seconden?** Zo niet → stop en vraag een langere versie.
2. Video kopiëren naar `frontend/src/assets/landing-hero-desktop.mp4`
3. `LandingScreen.tsx` aanpassen:
   - `HeroMedia` splitsen in `<DesktopHero>` (fullscreen video + tekstoverlay) en `<MobileHero>`
   - Switch via `useWindowDimensions()`, breakpoint 1024px
   - Tekst absoluut gepositioneerd in linker-kolom 52%, verticaal gecentreerd
   - Subtiele linkse vertical gradient voor leesbaarheid
4. Z-index management: video laag 0, gradient laag 1, tekst+CTA laag 3
5. `npx tsc --noEmit` → geen TS errors
6. Vercel deploy

---

## ✅ Acceptatiecriteria (Desktop)

- [ ] Video duurt minimaal 8 seconden
- [ ] Video speelt fullscreen op desktop ≥ 1024px
- [ ] Video heeft geen randen, blokken of `border-radius`
- [ ] Video speelt 1× af en freezet op laatste frame
- [ ] Tekst staat duidelijk leesbaar op de video
- [ ] Tekst overlapt **nooit** het SpeeQ-logo
- [ ] Op mobiel verschijnt de mobile hero (niet de zware desktop video)
- [ ] CTA-knop opent het code-gate (flow blijft intact)
- [ ] Code-gate → login → tool flow werkt nog
- [ ] Naadloze overgang van video naar `#F8FAFC` pagina

---

<a id="mobile-hero-brief"></a>

# 📋 DESIGN BRIEF — Mobile Hero Video op Landing Page

## 🎯 Doel
Spiegel van de desktop-hero, maar dan voor de telefoon. **Fullscreen verticale video** op mobiel die in de eerste seconden hetzelfde "high-end govtech" gevoel geeft als de desktop-versie. Marketing-tekst geprojecteerd over de video — **logo blijft altijd vrij**.

---

## 📱 Scope
- **Alleen voor mobiel / smal scherm** (viewport breedte **< 1024px**)
- **Niet voor desktop** — daar blijft de huidige cinematic horizontale hero
- Video aangeleverd in `frontend/src/assets/landing-hero-mobile.mp4`
- **⏱️ Minimale duur: 8 seconden** — korter mag NIET

---

## 🎬 Hoe de video gepresenteerd wordt

**Layout:** edge-to-edge fullscreen op telefoon
- Video vult **100% van de viewport-breedte** (`width: 100vw`)
- Hoogte: **100vh** of `min-h-dvh` (zodat 'ie netjes onder de iOS browser-balk past)
- `object-fit: cover` → vult elk telefoon-formaat zonder zwarte balken
- Geen rand, geen `border-radius`, geen padding rondom → pure cinematic
- Geen `<header>` of `<nav>` erboven
- `autoplay`, `muted`, `playsinline` (verplicht voor iOS Safari autoplay)
- **`loop: false`** — video speelt 1× af en **freezet op laatste frame**
- `preload="auto"`

**Achtergrond-naadloosheid:**
- Onder de video begint dezelfde `#F8FAFC` als de rest van de pagina
- Subtiele 24px fade onderaan voor zachte overgang naar features-blok

---

## ✍️ Hoe de tekst op de video komt

**Belangrijkste regel:**
> ❗ De tekst mag **NOOIT** over het SpeeQ-logo in de video heen vallen.

**Concrete oplossing voor mobiel:**

De mobiele video heeft het logo waarschijnlijk **boven of midden** in de verticale frame. Daarom plaats ik tekst in de **onderste 35–45% van het scherm**, gecentreerd, met safe-area padding.

| Element | Positie |
|---|---|
| Eyebrow (`SPEEQ WKB TOOL`) | Onderkant zone, klein, in caps |
| Headline (`Wkb-dossier in één foto`) | 32–36px op telefoon |
| Sub-tekst (2 regels) | 15–16px |
| CTA-knop (`Open de tool →`) | Ruime knop, SpeeQ-groen `#7CB94B` |
| Hint (toegangscode) | Onder de CTA, klein, secundair |

**Leesbaarheids-overlay:**
- Subtiele bottom-gradient: `linear-gradient(to top, rgba(11,22,40,0.32) 0%, rgba(11,22,40,0.15) 40%, rgba(11,22,40,0) 75%)`
- Alleen onder de tekst-zone — boven de helft blijft de video schoon zodat het logo vrij is
- Tekst zelf in **wit** met `text-shadow` voor extra contrast op lichte video-frames

**Safe-area:**
- iPhone notch / Dynamic Island bovenaan → tekst en CTA altijd minstens 24px van de bovenrand
- Home indicator onderaan → CTA en hint altijd minstens 32px van de onderrand
- `paddingBottom: 'env(safe-area-inset-bottom, 32px)'`

---

## 📝 Tekst-content

| Element | Tekst |
|---|---|
| Eyebrow | `SPEEQ WKB TOOL` |
| Headline (32–36px) | `Wkb-dossier in één foto.` |
| Sub (15–16px) | `De vakman maakt een foto, SpeeQ doet de rest — AI-validatie, GPS-koppeling, dossier-opbouw.` |
| Primary CTA | `Open de tool →` |
| Hint | `Toegangscode nodig — vraag aan bij Spee Solutions.` |

---

## 🛠️ Implementatie-stappen voor Claude

1. **Eerst checken: duurt de video ≥ 8 seconden?** Zo niet → stop en vraag langere versie.
2. **Check ook:** is het **portret/9:16** oriëntatie? Anders raar fullscreen op telefoon.
3. Video kopiëren naar `frontend/src/assets/landing-hero-mobile.mp4`
4. `LandingScreen.tsx` aanpassen:
   - `MobileLanding` krijgt dezelfde fullscreen-video-aanpak als `DesktopLanding`
   - Huidige compacte hero (statisch logo / kleine video) wordt vervangen
   - Tekst absoluut gepositioneerd in onderste 40%, met bottom-gradient + text-shadow
   - `useWindowDimensions` blijft de breakpoint-switch
   - **`loop: false`** zodat 'ie freezet op laatste frame
   - Safe-area padding voor iOS notch + home indicator
5. **Native fallback** (iOS/Android via Expo, niet web): blijft het statische 3D-logo. Dit raakt alleen mobiele **web** versie.
6. `npx tsc --noEmit` → geen TS errors
7. Vercel deploy
8. Check op telefoon met Safari/Chrome + hard refresh

---

## ✅ Acceptatiecriteria (Mobile)

- [ ] Video duurt minimaal 8 seconden
- [ ] Video is portret-oriëntatie (9:16 of vergelijkbaar)
- [ ] Video speelt fullscreen op telefoon (< 1024px breed)
- [ ] Video heeft geen randen, blokken of `border-radius`
- [ ] Video speelt 1× af en freezet op laatste frame
- [ ] Tekst overlapt **nooit** het SpeeQ-logo
- [ ] Tekst goed leesbaar tijdens de hele 8 sec
- [ ] CTA boven de iOS home-indicator (geen overlap)
- [ ] Tekst onder de iOS notch (geen overlap)
- [ ] Op desktop verschijnt nog steeds de horizontale hero
- [ ] CTA-knop opent het code-gate (flow blijft intact)

---

<a id="hoe-gebruik-je-deze-briefs"></a>

## 📌 Hoe gebruik je deze briefs

**Voor de desktop-hero:**
Plak het hele blok "Desktop Hero Brief" terug in de Claude chat met daarbij:
> *"Hier is de desktop video — voer de desktop design brief uit."*

**Voor de mobile-hero:**
Plak het hele blok "Mobile Hero Brief" terug in de Claude chat met daarbij:
> *"Hier is de mobiele video — voer de mobile design brief uit."*

Claude voert 'm in één keer uit volgens deze specs. Geen vragen, geen interpretatieruimte — alles staat erin.

---

## 🎨 Brand-conventies (geldt voor beide briefs)

| Asset | Waarde |
|---|---|
| Achtergrond pagina | `#F8FAFC` (Govtech light) |
| SpeeQ navy | `#1B3A5C` |
| SpeeQ groen (accent + CTA) | `#7CB94B` |
| Tekst-overlay op video | `#FFFFFF` met text-shadow |
| Donker gradient (RGB navy) | `rgba(11, 22, 40, …)` |
| Code-gate code | `code` (case-insensitive) |
| Vercel project (intern) | `wkb-snap-sync` — **niet hernoemen** |
| Live URLs | speeq-wkb-tool.vercel.app · speeq-wkb.vercel.app · wkb-snap-sync.vercel.app |

---

© 2026 Spee Solutions — SpeeQ WKB Tool
