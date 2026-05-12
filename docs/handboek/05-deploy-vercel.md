# 05 — Wijzigingen live krijgen (Vercel deploy)

> Hoe een nieuwe versie van de tool van jouw laptop naar `speeq-wkb.vercel.app` komt.

## Drie stappen

### 1. TypeScript check
```bash
cd "/Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq/frontend"
npx tsc --noEmit
```
Als dit ZONDER errors klaar is (exit code 0) → veilig om te deployen.
Als er errors zijn → eerst die fixen.

### 2. Deploy naar Vercel
```bash
npx vercel --prod --yes
```
Output ziet er ongeveer zo uit:
```
Production: https://speeq-<hash>-spee-solutions.vercel.app [ready]
```
Noteer die nieuwe deploy-URL. Deze deploy is nu live op die unieke URL — maar nog NIET op `speeq-wkb.vercel.app`.

### 3. Aliassen koppelen
```bash
npx vercel alias set speeq-<hash>-spee-solutions.vercel.app speeq-wkb.vercel.app
npx vercel alias set speeq-<hash>-spee-solutions.vercel.app speeq-wkb-tool.vercel.app
```
Vervang `<hash>` door wat je in stap 2 zag. Beide aliassen wijzen nu naar de nieuwe deploy.

## Wat doet Vercel onder water

1. `vercel.json` zegt:
   ```json
   "buildCommand": "npx expo export --platform web --output-dir dist"
   ```
2. Vercel cloud krijgt je code → installeert dependencies → bouwt
3. Output gaat in `dist/` map
4. Vercel deelt die wereldwijd via CDN
5. Aliassen worden ververst

Totale tijd: ~60 seconden van commando tot live.

## Aliassen die nu actief zijn

```
speeq-wkb.vercel.app          ← hoofd-URL (deel met klanten)
speeq-wkb-tool.vercel.app     ← backup, ook gekoppeld
```

Oude aliassen (uitgefaseerd, niet gebruiken):
- ~~wkb-snap-sync.vercel.app~~ (verwijderd)
- ~~wkb-snap-sync-*-spee-solutions.vercel.app~~ (verwijderd)

## Eigen domein voor de klant (optioneel, later)

Als Bouwgroep Jansen vraagt: "Kunnen we onze eigen URL gebruiken?"

1. Klant koopt `wkb.jansen.nl` bij een registrar
2. Klant maakt een CNAME-record: `wkb.jansen.nl → speeq-wkb.vercel.app`
3. In Vercel: project SpeeQ → Settings → Domains → Add → `wkb.jansen.nl`
4. Vercel maakt SSL-certificaat aan (gratis via Let's Encrypt)
5. Klant kan nu ook bereikbaar zijn via z'n eigen URL

Voor de tenant-detectie blijft `?t=jansen` nodig zolang we geen subdomein-routing hebben. (Later kan dat: subdomein `jansen.speeq-wkb.vercel.app` → automatisch slug `jansen`.)

## Wat NIET doen bij deploy

❌ **NIET** `vercel` zonder `--prod` flag — dat maakt een preview-deploy die de hoofd-URL niet update.
❌ **NIET** rechtstreeks `dist/` uploaden — gebruik altijd de CLI.
❌ **NIET** package-lock.json of node_modules committeren met handmatige wijzigingen — laat npm dat doen.
❌ **NIET** environment variables (`.env`) committeren — staan in `.gitignore` om een reden.

## Build-fouten oplossen

### "Module not found"
- Heb je `npm install` gedraaid na een pull?
- Staat het bestand in de juiste hoofdletters? (Linux is hoofdletter-gevoelig, Mac niet)

### "TypeScript error"
- Run `npx tsc --noEmit` lokaal en fix daar de error
- Vercel weigert te builden als TypeScript faalt

### "Out of memory"
- Bundle is te groot — check `dist/_expo/static/js/web/index-*.js`
- Tip: kijk of een grote import echt nodig is (lucide-react-native importeer je 1 icoon tegelijk)

### "Deploy lukt, maar site crasht in browser"
- Open DevTools → Console
- Vaak: Supabase URL/key mist, of een env-var ontbreekt op Vercel
- Vercel project → Settings → Environment Variables → check `EXPO_PUBLIC_*` vars

## Rollback naar vorige versie

Als een deploy stuk blijkt:
```bash
npx vercel ls    # toont laatste 20 deploys
npx vercel alias set <oudere-hash>-spee-solutions.vercel.app speeq-wkb.vercel.app
```
Hoofd-URL wijst nu weer naar oude versie. Geen rebuild nodig.

## Vercel project info

| Veld | Waarde |
|---|---|
| Project naam | speeq-wkb |
| Team | spee-solutions |
| Region | Auto (CDN wereldwijd) |
| Framework preset | Other (geen Next.js) |
| Build command | `npx expo export --platform web --output-dir dist` |
| Output dir | `dist` |

Inloggen op Vercel dashboard: https://vercel.com/spee-solutions

---

**Volgende doc:** [`06-test-checklist.md`](06-test-checklist.md) — wat je per release moet testen.
