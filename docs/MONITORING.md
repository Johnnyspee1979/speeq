# Monitoring — weet jij het eerder dan de klant?

Tot 25 juli 2026 was het antwoord nee. Er was alleen een Railway-healthcheck op
`/health`, en die zegt niets meer dan "het Node-proces ademt nog". Als Supabase
eruit lag, bleef die check gewoon groen — terwijl de app voor de vakman stuk was.
Ondertussen belooft de SOA **99,5% uptime met boeteclausule**. Een belofte die je
niet meet, is geen belofte.

## De drie endpoints en waarvoor ze zijn

| Endpoint | Raakt de database | Waarvoor |
|---|---|---|
| `/health` | nee | Railway liveness — herstart de container als Node dood is |
| `/api/health` | nee | snelle blik op de configuratie |
| **`/api/health/diep`** | **ja** | **externe monitoring — hier hang je de alarmbel aan** |

`/health` blijft bewust ondiep. Zou Railway op de diepe check draaien, dan gooit
één Supabase-hik je container om, en dat maakt een storing langer in plaats van
korter.

`/api/health/diep` doet een echte (goedkope) query op `tenants` en geeft:

- **200** met `"status":"gezond"` als de database antwoordt
- **503** met `"status":"ongezond"` als dat niet lukt, inclusief de foutmelding
  en hoe lang het duurde

E-mail (Resend) en de DSO-adapter staan er ook in, maar tellen bewust niet mee
voor gezond/ongezond: de app doet zijn werk zonder, en je wilt geen vals alarm om
drie uur 's nachts. Ze zijn wél zichtbaar zodra je kijkt.

Voorbeeld van een ongezond antwoord:

```json
{
  "status": "ongezond",
  "checks": {
    "database": { "ok": false, "ms": 5001, "melding": "time-out na 5s" }
  }
}
```

## Instellen (dit moet je zelf doen — er is een account voor nodig)

1. Maak een gratis account bij een uptime-dienst (Better Stack, UptimeRobot,
   Healthchecks.io — alle drie prima voor één endpoint).
2. Nieuwe monitor:
   - URL: `https://api.speesolutions.com/api/health/diep`
   - Interval: 1–3 minuten
   - Als fout beschouwen: alles behalve HTTP 200
   - Bevestiging: 2 mislukte pogingen achter elkaar (voorkomt ruis)
3. Alarm op **e-mail én telefoon**. Alleen e-mail werkt niet — dat lees je 's
   nachts niet.
4. Zet ook een monitor op `https://app.speesolutions.com` (de frontend). De
   backend kan prima draaien terwijl Vercel eruit ligt.

## Uptime aantoonbaar maken

Kies een dienst met een publieke statuspagina en zet die aan. Dan heb je bij een
discussie over de SLA een onafhankelijk logboek in plaats van je eigen woord.
Dat is precies wat artikel 3 van de SOA van je vraagt.

## Nog niet gedekt

- **Foutmeldingen in de app zelf** (een gebroken PDF-export bijvoorbeeld) zie je
  hiermee niet. Daarvoor is foutregistratie nodig — Sentry of gelijkwaardig.
- **Achtergrondtaken** (`backend/src/jobs`) worden niet bewaakt.
- De gezonde kant van `/api/health/diep` is lokaal niet te testen zonder
  Supabase-sleutels; die is voor het eerst echt te zien na deploy. De ongezonde
  kant is wél getest: geeft 503 met de juiste melding.
