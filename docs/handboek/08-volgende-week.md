# 08 — Volgende week: 5 acties, 5 dagen

> Geen overweldiging. Eén ding per dag. Max 2 uur. Klaar.
> Gemaakt op 12 mei 2026, 's avonds — voor Johnny's hoofd zodat hij kan slapen.

## Het principe

Je wil alles. Dat snap ik. Maar alles tegelijk = niets goed.
**Vijf dagen, vijf taken, één tegelijk.** Lees deze pagina morgenochtend bij koffie.

## De week

| Dag | Actie | Tijd | Type werk |
|---|---|---|---|
| **Maandag** | Founder-deal mail schrijven voor 3 doelklanten | 30 min | Schrijven |
| **Dinsdag** | Wachtwoord-vergeten + email-confirm afmaken | 2 uur | Code |
| **Woensdag** | Stitch landingpage live zetten | 1 uur | Visueel |
| **Donderdag** | Verwerkersovereenkomst + privacyverklaring | 1 uur | Juridisch |
| **Vrijdag** | Status-pagina + "in geval van nood"-document | 1 uur | Risico |

**Totaal: 5,5 uur over 5 dagen.** Dat past in je leven.

## Maandag — Founder mail

**Wat:**
Stuur 3 aannemers die je persoonlijk kent een mail met deze structuur:
- Wie je bent, wat SpeeQ is (2 zinnen)
- Wat ze krijgen: 12 maanden Pro voor Team-prijs (€149 i.p.v. €299)
- Wat jij terugkrijgt: testimonial + logo op website
- "Heb je 20 minuten deze week voor een demo?"

**Concept-mail laten schrijven door Claude:** "schrijf mij founder-mail voor 3 aannemers"

**Resultaat:** Mail in concept, klaar om te versturen.

## Dinsdag — Wachtwoord-knop + email confirm

**Wat:**
Twee kleine code-fixes die voorkomen dat klant #1 vastloopt:
1. Knop "Wachtwoord vergeten?" op tenant login → Supabase recovery mail
2. E-mail bevestigingslink redirect naar `/?t=<slug>` zodat klant netjes terugkomt

**Tegen Claude zeggen:** "open punt 1 en 2 uit doc 08, bouw het"

**Resultaat:** Klanten kunnen zelf wachtwoord resetten, geen support-explosie.

## Woensdag — Stitch landing live

**Wat:**
Je hebt de Stitch-prompt al af. Vandaag:
1. Plak prompt in Stitch
2. Kies beste design
3. Export naar Vercel-deploy
4. Alias instellen: `speeq.nl` of `speesolutions.com/speeq`

**Tegen Claude zeggen:** "help mij Stitch design uit te rollen op vercel"

**Resultaat:** Echte website live waar je klanten naartoe kunt sturen.

## Donderdag — Juridisch

**Wat:**
- Download ICT~Office voorwaarden template
- Vul SaaS-versie in (€299 niet-leden)
- Generator op veiliginternetten.nl: privacyverklaring
- Maak verwerkersovereenkomst-template (DDMA gratis)
- Upload alle 3 naar `docs/juridisch/` in je repo

**Tegen Claude zeggen:** "help mij juridische pack opzetten voor SpeeQ"

**Resultaat:** Je kunt elke Pro-klant binnen 5 min een DPA mailen.

## Vrijdag — Continuïteit

**Wat:**
- Maak UptimeRobot account (gratis), monitor 3 URL's: `speeq-wkb.vercel.app`, master Supabase API, maker-paneel
- Maak `docs/handboek/09-nood.md` met: alle wachtwoorden in 1Password-naam (niet de waardes), wie te bellen, hoe iemand `/maker` overneemt
- Zet auto-reply-template klaar in mail en WhatsApp

**Tegen Claude zeggen:** "help mij nood-pakket bouwen voor SpeeQ"

**Resultaat:** Je kunt griep krijgen zonder paniek.

## Wat je deze week NIET doet

❌ AI foto-analyse bouwen — later, niet kritiek voor klant #1
❌ Logo auto-resize — geen blokker
❌ Demo-data seed — kan vrijdag bij landing-launch
❌ Nieuwe features bedenken — eerst eerste klant betalend krijgen

## Hoe je het volhoudt

- **Tijd vastleggen**: zet 's avonds 30 min in agenda voor de dag-actie
- **Niet vooruitlopen**: doc 08 lezen → enkel die ene actie doen → klaar
- **Eind van de week**: bekijk doc 07 (prijsmodel) opnieuw — past het nog?
- **Geen perfectionisme**: 80% is goed genoeg voor week 1

## Voor nu: slapen

Alles staat hier. Op je Mac. Op GitHub. Je kan het niet kwijtraken.
Morgen open je doc 08 en doet alleen "Maandag". Niks anders.

---

**Vorige:** [07-prijsmodel](07-prijsmodel.md) · **Terug naar:** [README](README.md)
