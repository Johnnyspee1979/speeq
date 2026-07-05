# Juridisch pack — SpeeQ door Spee Solutions

> Vier documenten die je nodig hebt vóór je eerste betalende klant.
> Alle templates moeten op `[PLAATSHOUDERS]` worden ingevuld voordat je ze stuurt.

## De documenten

| Doc | Voor wie | Wanneer gebruiken |
|---|---|---|
| [01-verwerkersovereenkomst.md](01-verwerkersovereenkomst.md) | Iedere zakelijke klant (verplicht AVG) | Bij contractondertekening |
| [02-algemene-voorwaarden.md](02-algemene-voorwaarden.md) | Iedereen die SpeeQ gebruikt | Linken vanaf website footer + bij onboarding |
| [03-privacyverklaring.md](03-privacyverklaring.md) | Iedereen (verplicht AVG) | Op website + in app |
| [04-soa-service-overeenkomst.md](04-soa-service-overeenkomst.md) | Professional + Enterprise klanten | Bij contractondertekening |

## Eerste keer: invullen-checklist

Vóór gebruik moet je deze waardes per template invullen:

```
[BEDRIJF_NAAM]      → Spee Solutions
[KVK_NUMMER]        → <jouw KvK nummer>
[BTW_NUMMER]        → NL<jouw BTW>B01
[VESTIGINGSADRES]   → <straat + huisnummer>
[POSTCODE_PLAATS]   → <postcode> <plaats>
[EMAIL_CONTACT]     → hallo@speesolutions.com
[EMAIL_DPO]         → privacy@speesolutions.com (mag dezelfde zijn als contact)
[TELEFOON]          → +31 6 xxxxxxxx
[WEBSITE]           → https://speesolutions.com
[DATUM]             → 2026-05-13
[VERSIE]            → 1.0
```

**Tip:** zoek in alle vier de bestanden met `Cmd+F` op `[` om alle plaatshouders te vinden.

## Hoe gebruiken in de praktijk

### Bij nieuwe klant
1. Open `01-verwerkersovereenkomst.md`
2. Sla op als `dpa-<klantnaam>-2026.md` in je eigen map (NIET in deze repo)
3. Vul de klant-specifieke velden in (klantnaam, KvK, contactpersoon)
4. Converteer naar PDF via macOS Print → "Save as PDF"
5. Mail naar klant met verzoek tot ondertekening (eventueel via DocuSign/Adobe Sign)

### Op de website
- Footer: link naar `02-algemene-voorwaarden` en `03-privacyverklaring`
- Bij account-aanmaak: checkbox *"Ik ga akkoord met de voorwaarden en privacyverklaring"*
- Bij Professional-onboarding: stuur DPA mee als bijlage

## Belangrijke disclaimer

Deze templates zijn een **vertrekpunt op basis van standaard ICT-praktijk**.
- Voor Enterprise-klanten (maatwerk, op offerte) is een gang naar een specialist (Considerati, ICTRecht, of een lokale ICT-advocaat) aanbevolen
- Bij internationale klanten (buiten EU): laat een gespecialiseerd kantoor naar de cross-border data flows kijken
- Bij geschillen: deze documenten zijn geen vervanging voor juridisch advies

## Bron-templates die je verder kunt verfijnen

- **ICT~Office voorwaarden 2014** — branchestandaard NL, gratis voor leden (€299 niet-leden) — https://www.nldigital.nl
- **DDMA verwerkersovereenkomst** — gratis template voor leden — https://ddma.nl
- **Autoriteit Persoonsgegevens** — checklist DPO en verwerkersregister — https://autoriteitpersoonsgegevens.nl
- **Veiliginternetten.nl privacy generator** — voor de privacyverklaring zelf in te vullen — https://veiliginternetten.nl

---

**Terug naar:** [handboek README](../handboek/README.md)
