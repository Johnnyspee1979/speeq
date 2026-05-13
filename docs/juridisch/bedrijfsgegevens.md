# Bedrijfsgegevens — Spee Solutions

> **Eén bron** voor alle juridische templates.
> Vul deze waardes hier 1× in. Bij elke nieuwe DPA / SOA / klantcontract kopieer je hieruit.
> Bron: KvK-uittreksel + Belastingdienst BTW-bevestiging, opgehaald uit Google Drive op 2026-05-13.

## Officiële identiteit

| Veld | Waarde |
|---|---|
| **Handelsnaam** | Spee Solutions |
| **KvK-nummer** | 99314770 |
| **Vestigingsnummer** | 000064402665 |
| **Startdatum vestiging** | 01-01-2026 |
| **BTW-id** | **NL005384070B84** *(zoals op Belastingdienst-brief 17-01-2026; PDF-OCR las "NL005384070884" maar `B` zit altijd tussen cijfer 9 en 10)* |
| **OB-nummer** | 168186329805 |
| **Tenaamstelling Belastingdienst** | JO SPEE |

## Adres

| Veld | Waarde |
|---|---|
| **Bezoekadres** | Escamplaan 870 F |
| **Postcode + plaats** | 2547 EX 's-Gravenhage |
| **Postadres** | gelijk aan bezoekadres |

## Contact

| Veld | Waarde |
|---|---|
| **E-mail bedrijf (algemeen)** | info@speesolutions.com |
| **E-mail Johnny persoonlijk** | johnny@speesolutions.com |
| **E-mail juridisch/privacy** | privacy@speesolutions.com *(alias naar info@)* |
| **Telefoon** | +31 6 81908480 |
| **Website** | https://speesolutions.com |

## Activiteit (KvK SBI)

- **62200** — Advisering op het gebied van informatietechnologie
- **62100** — Ontwikkelen, produceren en uitgeven van software

**Officiële omschrijving:**
> Advisering op het gebied van administratieve organisatie en automatisering.
> Tevens het ontwikkelen van software en bieden van ondersteuning bij facturatie.

## Vertegenwoordiging

- **Naam:** Johnny Spee (handelt als JO SPEE bij Belastingdienst)
- **Functie:** Directeur / eigenaar / eenmanszaak-houder
- **Tekenbevoegd:** ja, zelfstandig

## Template-vervang-tabel

Gebruik deze mapping bij het invullen van `01-verwerkersovereenkomst.md`, `02-algemene-voorwaarden.md`, `03-privacyverklaring.md`, `04-soa-service-overeenkomst.md`:

| Placeholder in template | Vervangen door |
|---|---|
| `[BEDRIJF_NAAM]` | Spee Solutions |
| `[KVK_NUMMER]` | 99314770 |
| `[BTW_NUMMER]` | NL005384070B84 |
| `[VESTIGINGSADRES]` | Escamplaan 870 F |
| `[POSTCODE_PLAATS]` | 2547 EX 's-Gravenhage |
| `[EMAIL_CONTACT]` | info@speesolutions.com |
| `[EMAIL_PRIVACY]` | privacy@speesolutions.com |
| `[TELEFOON]` | +31 6 81908480 |
| `[WEBSITE]` | https://speesolutions.com |
| `[DATUM]` | 2026-05-13 *(of dag van verstrekken aan klant)* |
| `[VERSIE]` | 1.0 |
| `[REISTARIEF]` | 0,55 *(€/km on-site > 50 km — standaard ZZP)* |
| `[UURTARIEF]` | 125 *(€/uur consultancy/training)* |

## Te controleren / nog te bevestigen

- [x] **BTW-id `B`-positie verifiëren** — bevestigd door Johnny 2026-05-13: **NL005384070B84** is juist.
- [ ] **privacy@speesolutions.com** — alias instellen in Google Workspace zodat mails op `info@` binnenkomen
- [ ] **Postadres voor formele post** — bij eenmanszaak vanuit thuisadres = ok, maar overweeg postbus voor klantfacing-juridiek

## Veiligheid van dit bestand

Dit bestand bevat **geen** BSN, geen IBAN, geen wachtwoorden. KvK-nummer en BTW-id zijn **openbaar** (staan publiek in KvK-register). Bezoekadres staat publiek in KvK. Dit bestand mag dus in Git.

**Wel niet hier neerzetten:**
- BSN
- IBAN / bankrekeningnummer
- Persoonlijke (niet-zakelijke) e-mail of telefoon
- API-keys / wachtwoorden / Supabase service-keys

---

*Versie 1.0 · 2026-05-13 · Bron: Google Drive (KVK SpeeSolutions Software pdf + Btw nummer SpeeSolutions.Pdf)*
