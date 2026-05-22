# Redesign Kwaliteitsborger Dashboard — Plan voor verse sessie

**Doel:** Hoofdpagina van SpeeQ verkoop-klaar maken. Rust, premium, scanbaar.
**Bestand:** waarschijnlijk `frontend/src/screens/WerkvoorbereiderDashboard.tsx` (heeft tabs Werkvoorbereider / Kwaliteitsborger / AI-model).
**Logica:** ALLE data-fetching, save-functies, state-handlers blijven 1-op-1 hetzelfde.

---

## KRITIEK — DICHTHEID (toegevoegd 19-05-2026 namiddag)

**Probleem:** Boven-helft van het scherm = 70% van de viewport.
Gebruiker ziet maar **1 evidence-card** zonder te scrollen.
**Doel:** **Minimaal 5 kaarten** zichtbaar zonder scrollen.

### Verwijderen of comprimeren

| Element | Actie |
|---|---|
| "Projectcontext" grijze balk | **VERWIJDEREN** — context staat al in project-balk |
| Subtitle "Beoordeel voldoende bewijs..." onder titel | **VERWIJDEREN** — overbodig |
| 5 stat-cards (Totaal/Openstaand/Goedgekeurd/Beoordeling/Afgekeurd) | **INLINE op 1 regel**: "**0** totaal · **0** open · **0** goed · **0** review · **0** afgekeurd" |
| Filter-chips | **Op zelfde regel als zoekbalk** (rechts van search input) |
| Evidence-card hoogte | **Max 90px** — foto 60×60, alleen ID + status + 1 actie-knop |
| GPS/SHA/EXIF/coords in elke kaart | **WEG** uit standaard view — alleen in detail-modal |

### Inline stat-regel voorbeeld

```tsx
<View style={styles.statInline}>
  <Text style={styles.statInlineText}>
    <Text style={styles.statInlineNum}>{stats.total}</Text> totaal
    {'  ·  '}
    <Text style={styles.statInlineNum}>{stats.open}</Text> openstaand
    {'  ·  '}
    <Text style={[styles.statInlineNum, { color: '#059669' }]}>{stats.approved}</Text> goedgekeurd
    {'  ·  '}
    <Text style={[styles.statInlineNum, { color: '#9a6c1c' }]}>{stats.review}</Text> review
    {'  ·  '}
    <Text style={[styles.statInlineNum, { color: '#dc2626' }]}>{stats.rejected}</Text> afgekeurd
  </Text>
</View>
```

```ts
statInline: {
  paddingHorizontal: 16, paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: 'rgba(120,90,70,0.04)',
  marginBottom: 12,
},
statInlineText: {
  fontSize: 13,
  color: theme.colors.textSecondary,
  letterSpacing: 0.2,
},
statInlineNum: {
  fontSize: 15, fontWeight: '800',
  color: theme.colors.textPrimary,
},
```

### Compacte evidence-card (max 90px hoog)

```tsx
<View style={styles.evidenceRowCompact}>
  <Image source={{ uri: item.photoUrl }} style={styles.evidenceThumb} />
  <View style={styles.evidenceInfo}>
    <Text style={styles.evidenceId}>{item.taskId}</Text>
    <Text style={styles.evidenceMeta}>
      {item.projectName ?? item.projectId} · {formatDate(item.createdAt)}
    </Text>
  </View>
  <StatusPill status={item.status} />
  <TouchableOpacity style={styles.detailBtn} onPress={() => openDetail(item.id)}>
    <Text style={styles.detailBtnText}>Details →</Text>
  </TouchableOpacity>
</View>
```

```ts
evidenceRowCompact: {
  flexDirection: 'row', alignItems: 'center',
  gap: 14,
  padding: 14,
  marginBottom: 8,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(120,90,70,0.12)',
  backgroundColor: theme.colors.surface,
  minHeight: 88,
  maxHeight: 100,
},
evidenceThumb: {
  width: 60, height: 60, borderRadius: 8,
},
evidenceInfo: { flex: 1, gap: 2, minWidth: 0 },
evidenceId: {
  fontSize: 14, fontWeight: '700',
  color: theme.colors.textPrimary,
  letterSpacing: -0.2,
},
evidenceMeta: {
  fontSize: 12,
  color: theme.colors.textSecondary,
},
detailBtn: {
  paddingHorizontal: 12, paddingVertical: 7,
  borderRadius: 8,
  backgroundColor: 'rgba(120,90,70,0.08)',
},
detailBtnText: {
  fontSize: 12, fontWeight: '600',
  color: theme.colors.textPrimary,
},
```

### Resultaat boven-fold (1280×800 desktop)

```
Header (compact)           40px
Project-balk (compact)     50px
Tabs                       50px
Titel + 2 knoppen          70px
Stat inline                40px
Search + filters inline    50px
                          ----
Totaal "chrome"           300px

Beschikbaar voor cards:   500px
Card-hoogte:               90px (incl margin)
Cards zichtbaar:    500/90 = 5.5 ✅
```

---

## Probleem-analyse (van screenshot, 19-05-2026)

Wat een koper denkt als ie de pagina ziet:

1. **Vier RODE actie-knoppen** rechtsonder per kaart ("EXIF openen", "open", "Stepmoment open", "Meetmiddel open")
   → leest als "er zijn 4 errors", terwijl het gewoon "details bekijken" is
2. **Vijf "0"-tellers** schreeuwen "Totaal 0, Openstaand 0, Goedgekeurd 0..." prominent in beeld
   → leest als "de tool werkt niet" of "leeg systeem"
3. **Drie grote groene knoppen + groene tab + groene sidebar-item** door elkaar
   → "Waar moet ik kijken?" — geen visuele hiërarchie, alles is even belangrijk
4. **Developer-info zichtbaar in elke kaart**: `GPS: 52.0908, 4.3008`, `SHA-256: ...`, `EXIF`, `AI-vertrouwen: —`
   → dit is technische rommel die alleen jij snapt; klant moet dit niet zien
5. **Geen Combivo logo** linksboven — alleen tekst "Combivo Vastgoedonderhoud"
   → mist de premium-touch

---

## Designprincipes

- **Eén primary kleur per scherm** — alleen "Vernieuwen" mag groen zijn
- **Rood alleen bij echte fouten** — niet bij standaard acties
- **Empty states zijn vriendelijk** — niet 5 keer "0"
- **Verbergen wat de klant niet hoeft te zien** (EXIF, hashes, ruwe GPS)
- **Premium look:** warm cream/beige, italic serif title

---

## Concrete wijzigingen

### Stap 0 — Vind het juiste bestand

```bash
grep -l "Kwaliteitsborger Dashboard" frontend/src/screens/*.tsx
```

Verwachting: `WerkvoorbereiderDashboard.tsx` of `KwaliteitsborgerDashboard.tsx`.
Open dat bestand. Hieronder = "het bestand".

---

### A. De 4 rode knoppen vervangen door 1 nette knop

Zoek in het bestand naar:
- `EXIF openen` of `EXIF`
- `Stepmoment open`
- `Meetmiddel open`

Dat is een rij van 4 `<TouchableOpacity>` knoppen onderaan elke evidence-card.

**Vervang die hele rij** door één knop:

```tsx
<TouchableOpacity
  style={styles.detailBtn}
  onPress={() => setSelectedEvidenceId(item.id)}  // bestaande state-pattern hergebruiken
  activeOpacity={0.85}
>
  <Text style={styles.detailBtnText}>Details bekijken →</Text>
</TouchableOpacity>
```

Style:
```ts
detailBtn: {
  paddingHorizontal: 16,
  paddingVertical: 9,
  borderRadius: 10,
  backgroundColor: 'rgba(120,90,70,0.08)',
  alignSelf: 'flex-start',
  marginTop: 8,
},
detailBtnText: {
  fontSize: 13,
  fontWeight: '600',
  color: theme.colors.textPrimary,
  letterSpacing: 0.2,
},
```

De content die er nu in zit (EXIF / Stepmoment / Meetmiddel) verhuist naar een **detail-modal** of een **uitklappaneel** binnen dezelfde kaart (eerste klik = open, tweede = sluit).

Voor de demo: simpelste oplossing = uitklappaneel onder de kaart met die info, in plaats van 4 popups.

---

### B. Stat-tellers vriendelijker maken

Zoek de stat-block: `Totaal`, `Openstaand`, `Goedgekeurd`, `Beoordeling`, `Afgekeurd`.

**Vervang** dat block door een conditional:

```tsx
{stats.total === 0 ? (
  <View style={styles.emptyStatBox}>
    <Text style={styles.emptyStatIcon}>📭</Text>
    <Text style={styles.emptyStatTitle}>Nog geen bewijs binnen</Text>
    <Text style={styles.emptyStatSub}>
      Zodra de vakman foto's maakt, zie je hier de voortgang.
    </Text>
  </View>
) : (
  <View style={styles.statRow}>
    {/* huidige 5 stat-cards, ongewijzigd */}
  </View>
)}
```

Style:
```ts
emptyStatBox: {
  padding: 32,
  borderRadius: 14,
  backgroundColor: theme.colors.surface,
  borderWidth: 1,
  borderColor: 'rgba(120,90,70,0.1)',
  alignItems: 'center',
  marginBottom: 16,
},
emptyStatIcon: { fontSize: 32, marginBottom: 8 },
emptyStatTitle: {
  fontSize: 16, fontWeight: '700',
  color: theme.colors.textPrimary,
  marginBottom: 4,
},
emptyStatSub: {
  fontSize: 13,
  color: theme.colors.textSecondary,
  textAlign: 'center',
},
```

---

### C. Groene knoppen — slechts ÉÉN primary

Zoek "Push naar KiK" en "Vernieuwen" (twee groene knoppen rechtsboven).

- **"Vernieuwen"** blijft groen primary (kleine, ronde)
- **"Push naar KiK"** wordt **secundair** (lichtgrijs/transparant met groene tekst)

```tsx
// Push naar KiK — secundair
<TouchableOpacity style={styles.secondaryBtn} onPress={pushToKik}>
  <Text style={styles.secondaryBtnText}>Push naar KiK</Text>
</TouchableOpacity>

// Vernieuwen — primary (enige groene knop op deze pagina)
<TouchableOpacity style={styles.primaryBtn} onPress={refresh}>
  <Text style={styles.primaryBtnText}>Vernieuwen</Text>
</TouchableOpacity>
```

```ts
secondaryBtn: {
  paddingHorizontal: 14, paddingVertical: 9,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: 'rgba(5,150,105,0.3)',
  backgroundColor: 'transparent',
},
secondaryBtnText: {
  fontSize: 13, fontWeight: '600',
  color: '#059669',
},
primaryBtn: {
  paddingHorizontal: 16, paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: '#059669',
},
primaryBtnText: {
  fontSize: 13, fontWeight: '700',
  color: '#ffffff',
},
```

---

### D. Developer-rommel uit de kaart

Zoek in de evidence-card render naar deze velden en **verberg ze voor niet-developers**:

- `GPS: 52.0908 , 4.3008`
- `GPS-coördinaten: —`
- `AI-vertrouwen: —`
- `SHA-256: ...`

Vervang door één compacte regel met enkel **betekenisvolle** info:

```tsx
<Text style={styles.cardMeta}>
  {item.projectName ?? item.projectId}  ·  {formatDate(item.createdAt)}
  {item.location ? `  ·  📍 ${item.location}` : ''}
</Text>
```

Helper:
```ts
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
```

De technische velden (GPS-coords, SHA, EXIF) verhuizen naar het **uitklap-detailpaneel** (zie sectie A) — alleen zichtbaar als gebruiker klikt op "Details bekijken".

---

### E. Header — Combivo logo erin

Zoek `<Text>Combivo Vastgoedonderhoud</Text>` of `getBranding().companyName`.

Vervang door:
```tsx
<View style={styles.brandRow}>
  {branding.logoUrl ? (
    <Image source={{ uri: branding.logoUrl }} style={styles.brandLogo} resizeMode="contain" />
  ) : null}
  <View>
    <Text style={styles.brandName}>{branding.companyName}</Text>
    <Text style={styles.brandSub}>Offline-first WKB-workflow</Text>
  </View>
</View>
```

```ts
brandRow: {
  flexDirection: 'row', alignItems: 'center', gap: 12,
  paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
},
brandLogo: { width: 40, height: 40, borderRadius: 8 },
brandName: {
  fontSize: 22, fontWeight: '800',
  color: theme.colors.textPrimary,
  letterSpacing: -0.5,
},
brandSub: {
  fontSize: 12, color: theme.colors.textSecondary,
},
```

Als er geen logoUrl is — gebruik een initial-circle in plaats van skip.

---

### F. Voor de DEMO: zaai 3 stuks demo-bewijs

Als de tellers tijdens demo nog steeds 0 zijn, ziet het er kaal uit.
Voor de investeerder-demo: maak handmatig 3 evidence-rijen aan in Combivo's Supabase:

```sql
-- In Supabase SQL editor voor Combivo's database:
INSERT INTO evidence (project_id, task_id, photo_url, status, created_at, ai_status)
VALUES
  ('demo-project', 'KIK-VENTILATIE-001', 'https://...', 'APPROVED', now() - interval '2 hours', 'PASSED'),
  ('demo-project', 'KIK-ISOLATIE-002', 'https://...', 'PENDING', now() - interval '5 hours', 'NEEDS_REVIEW'),
  ('demo-project', 'KIK-BRANDWERING-003', 'https://...', 'REJECTED', now() - interval '1 day', 'FAILED');
```

Dan zien de stats er uit als: `Totaal 3 · Openstaand 1 · Goedgekeurd 1 · Afgekeurd 1`. Verkoopt veel beter.

---

## Volgorde voor verse sessie

```
1. Open verse Claude Code sessie:
   cd "/Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq"

2. Prompt aan Claude:
   "Lees /Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq/REDESIGN_KWALITEITSBORGER.md
    en voer stappen A t/m E uit op het Kwaliteitsborger Dashboard scherm.
    Behoud ALLE bestaande logica. Verander alleen render + styles.
    Doe ook stap F (demo-data) als Combivo's database leeg is."

3. Verificatie:
   - npx tsc --noEmit (geen errors)
   - Lokaal checken: npm run web → /admin → Kwaliteitsborger tab
   - Geen rode knoppen meer per kaart, één "Details bekijken"
   - Geen GPS-coordinaten / SHA / EXIF zichtbaar op standaard view
   - Bij leeg dashboard: vriendelijke empty-state

4. Deploy:
   cd frontend && npx vercel --prod --yes
   npx vercel alias set <new-url> speeq-wkb-tool.vercel.app
```

---

## Wat je morgen op LinkedIn kan zetten

Met deze fixes + 3 demo-bewijzen kun je dit screenshot delen:

> "Zo zie ik als kwaliteitsborger live wat er op de bouw gebeurt.
>  Vakman foto → cloud → dossier. Eén klik naar KiK.
>  SpeeQ — borging zonder Excel-soep."

Eén beeld, één regel, één pijn weggenomen. Genoeg voor de eerste 10 reacties.

---

*Versie 1.0 · 19-05-2026 · Voor verse sessie · Johnny voert plan uit.*
