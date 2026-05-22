# Redesign TeamBeheerScreen — Plan voor verse sessie

**Doel:** TeamBeheerScreen.tsx krijgt premium-uitstraling. Warm, rustig, scanbaar.
**Bestand:** `frontend/src/screens/TeamBeheerScreen.tsx` (1649 regels, blijft één bestand).
**Logica:** ALLE data-fetching, save-functies, state-handlers blijven 1-op-1 hetzelfde.
Alleen het visuele laag verandert (render + styles).

---

## Probleem-analyse (waarom Johnny "niet professioneel" vond)

1. **Form staat default open** — alle chip-rijen en project-bullets in één klap zichtbaar
2. **Te veel kleur tegelijk** — accent-rood, cyan #0891b2, groen #059669, oranje #9B6700 door elkaar
3. **Dichte informatie** — 6 disciplines + 15 job-types + alle projecten als bullet-lijst, geen rust
4. **Visuele inconsistentie** — chips, knoppen, badges hebben elk hun eigen radius/padding/border
5. **Geen hiërarchie** — titel "Team & Bevoegdheden" oogt even zwaar als een member-card

---

## Designprincipes (per Johnny's CLAUDE.md)

- **Warm/cream palette** boven cold tech-blauw
- **Italic serif accents** voor premium feel
- **Max 3 acties** per scherm op één moment
- **Rust > drukte** — als twijfel: ingetogen
- **Visuele hiërarchie** via typografie en whitespace, niet via meer kleuren

---

## Nieuwe layout — ASCII-overzicht

```
┌─────────────────────────────────────────────────────────┐
│  TEAMBEHEER                                              │ ← eyebrow caps
│                                                          │
│  Team                                                    │ ← serif italic accent
│  Beheer wie er voor je werkt                             │ ← rustige subtitle
│                                                          │
│  ┌─[ Team (4) ]──[ Bevoegdheden ]─────────────────┐     │ ← tabs (huidig)
│                                                          │
│  ┌──────────────────────────────────┐  ┌───────────┐    │
│  │ Filter: alle disciplines  ▾      │  │ + Nieuw   │    │ ← primary CTA rechts
│  └──────────────────────────────────┘  └───────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ●  Jan Pietersen                  📲    ✏️       │   │ ← member-card (rust)
│  │    Voorman · Bouw / Brandveiligheid              │   │
│  │    jan@combivo.nl                                │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ●  Mehmet Yıldız                  📲    ✏️       │   │
│  │    Kitter · Schilder / Afbouw                    │   │
│  │    + 2 extra taken                               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

Wanneer "+ Nieuw" klik → modal/sheet opent met stappen:
  Stap 1 → Naam + contact
  Stap 2 → Profiel (job-type chips)
  Stap 3 → Projecten (alleen indien relevant)
  Stap 4 → Bevestig → genereer QR
```

---

## Concrete wijzigingen

### A. Header — rustiger, premium

Vervang regels 416-423 door:

```tsx
<View style={styles.pageHeader}>
  <Text style={styles.eyebrow}>TEAMBEHEER</Text>
  <Text style={styles.pageTitleSerif}>Team</Text>
  <Text style={styles.pageSubtitle}>
    Beheer wie er voor je werkt — uitnodigen, rollen, toegang.
  </Text>
</View>
```

In `createStyles`:

```ts
pageTitleSerif: {
  fontSize: 40,
  fontStyle: 'italic',
  fontFamily: Platform.OS === 'web' ? 'Georgia, "Playfair Display", serif' : 'serif',
  fontWeight: '500',
  color: theme.colors.textPrimary,
  letterSpacing: -1,
  marginBottom: 6,
  marginTop: 2,
},
```

(verwijder/vervang `pageTitle` style)

---

### B. Top-bar met telling + filter + CTA

Tussen tab-switcher (regel 443) en members-lijst (regel 477), nieuwe block:

```tsx
{activeTab === 'team' && !loading && !loadError ? (
  <View style={styles.topBar}>
    <Text style={styles.countLabel}>
      <Text style={styles.countNumber}>{members.length}</Text>{' '}
      {members.length === 1 ? 'teamlid' : 'teamleden'}
    </Text>

    <TouchableOpacity
      style={styles.primaryCta}
      onPress={() => setShowAddForm(true)}
      activeOpacity={0.85}
    >
      <Text style={styles.primaryCtaText}>+ Nieuw teamlid</Text>
    </TouchableOpacity>
  </View>
) : null}
```

Styles:

```ts
topBar: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
  flexWrap: 'wrap',
  gap: 12,
},
countLabel: {
  fontSize: 13,
  color: theme.colors.textSecondary,
  letterSpacing: 0.3,
},
countNumber: {
  fontSize: 16,
  fontWeight: '800',
  color: theme.colors.textPrimary,
},
primaryCta: {
  paddingHorizontal: 18,
  paddingVertical: 11,
  borderRadius: 999,
  backgroundColor: theme.colors.textPrimary,
},
primaryCtaText: {
  color: theme.colors.background,
  fontSize: 13,
  fontWeight: '700',
  letterSpacing: 0.3,
},
```

---

### C. Member-card — kalmer, minder chip-spam

Vervang regels 478-562 (de hele memberCard render, NIET de logica) door:

```tsx
<View
  key={member.id}
  style={[styles.memberCardV2, { backgroundColor: theme.colors.surface }]}
>
  <View style={styles.memberRow}>
    {/* Avatar + status */}
    <View style={styles.avatarWrap}>
      <View style={styles.avatarCircleV2}>
        <Text style={styles.avatarText}>
          {member.displayName
            .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </Text>
      </View>
      <View style={[
        styles.statusDotV2,
        { backgroundColor: member.isOnline ? '#059669' : '#cbd5e1' },
      ]} />
    </View>

    {/* Info */}
    <View style={styles.memberInfoV2}>
      <Text style={styles.memberNameV2}>{member.displayName}</Text>
      <Text style={styles.memberMetaV2}>
        {JOB_LABELS[member.jobType] ?? member.jobType}
        {member.disciplines.length > 0 ? (
          <Text style={styles.memberMetaDim}>
            {'  ·  '}
            {member.disciplines.map(d => DISCIPLINE_LABELS[d]).join(' / ')}
          </Text>
        ) : null}
      </Text>
      {member.email ? (
        <Text style={styles.memberEmailV2}>{member.email}</Text>
      ) : null}
      {member.extraTaskIds.length > 0 ? (
        <Text style={styles.memberExtraNote}>
          + {member.extraTaskIds.length} extra {member.extraTaskIds.length === 1 ? 'taak' : 'taken'}
        </Text>
      ) : null}
    </View>

    {/* Acties */}
    <View style={styles.memberActionsV2}>
      {member.inviteToken && !member.inviteAcceptedAt ? (
        <View style={styles.pendingPill}>
          <Text style={styles.pendingPillText}>uitgenodigd</Text>
        </View>
      ) : member.inviteAcceptedAt ? (
        <View style={styles.activePill}>
          <Text style={styles.activePillText}>actief</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => setQrMemberId(qrMemberId === member.id ? null : member.id)}
      >
        <Text style={styles.iconBtnText}>📲</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => {
          setQrMemberId(null);
          setEditingId(editingId === member.id ? null : member.id);
        }}
      >
        <Text style={styles.iconBtnText}>✏️</Text>
      </TouchableOpacity>
    </View>
  </View>

  {/* QR-panel en edit-panel BLIJVEN exact zoals ze waren (regels 594-861) */}
  {qrMemberId === member.id ? ( /* … bestaande qrPanel render … */ ) : null}
  {editingId === member.id ? ( /* … bestaande editPanel render … */ ) : null}
</View>
```

Styles toevoegen:

```ts
memberCardV2: {
  borderRadius: 14,
  padding: 18,
  borderWidth: 1,
  borderColor: 'rgba(120,90,70,0.12)',  // warm border ipv koud grijs
  shadowColor: '#7a5a3f',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 1,
  gap: 0,
},
memberRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 14,
},
avatarWrap: { position: 'relative' },
avatarCircleV2: {
  width: 48, height: 48, borderRadius: 24,
  backgroundColor: 'rgba(164,13,47,0.08)',
  alignItems: 'center', justifyContent: 'center',
},
statusDotV2: {
  position: 'absolute', right: -1, bottom: -1,
  width: 12, height: 12, borderRadius: 6,
  borderWidth: 2, borderColor: theme.colors.surface,
},
memberInfoV2: { flex: 1, gap: 3, minWidth: 0 },
memberNameV2: {
  fontSize: 16, fontWeight: '700',
  color: theme.colors.textPrimary,
  letterSpacing: -0.2,
},
memberMetaV2: {
  fontSize: 13, color: theme.colors.textPrimary,
  fontWeight: '500',
},
memberMetaDim: { color: theme.colors.textSecondary, fontWeight: '400' },
memberEmailV2: {
  fontSize: 12, color: theme.colors.textSecondary, marginTop: 2,
},
memberExtraNote: {
  fontSize: 11, fontStyle: 'italic',
  color: theme.colors.accent, marginTop: 4,
},
memberActionsV2: {
  flexDirection: 'row', gap: 6, alignItems: 'center',
},
pendingPill: {
  paddingHorizontal: 8, paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: 'rgba(154,108,28,0.12)',
},
pendingPillText: {
  fontSize: 10, fontWeight: '700', letterSpacing: 0.3,
  color: '#9a6c1c',
},
activePill: {
  paddingHorizontal: 8, paddingVertical: 3,
  borderRadius: 999,
  backgroundColor: 'rgba(5,150,105,0.1)',
},
activePillText: {
  fontSize: 10, fontWeight: '700', letterSpacing: 0.3,
  color: '#059669',
},
iconBtn: {
  width: 36, height: 36, borderRadius: 10,
  backgroundColor: 'rgba(120,90,70,0.06)',
  alignItems: 'center', justifyContent: 'center',
},
iconBtnText: { fontSize: 15 },
```

---

### D. "Nieuw teamlid" form → sheet/modal

Het probleem: form schreeuwt onderaan de pagina mee.
Oplossing: zelfde form, maar in een lichte modal-card bovenop (web: fixed overlay).

Vervang regels 881-1065 (showAddForm block) door:

```tsx
{showAddForm ? (
  <View style={styles.sheetBackdrop}>
    <View style={[styles.sheetCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Nieuw teamlid</Text>
        <TouchableOpacity onPress={() => setShowAddForm(false)} style={styles.sheetCloseBtn}>
          <Text style={styles.sheetCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sheetSubtitle}>
        Vul de basis in — disciplines volgen automatisch uit het profiel.
      </Text>

      {/* Inputs (zelfde TextInput-blokken als regels 892-937) */}
      <TextInput style={styles.inputV2} value={newName} onChangeText={setNewName}
                 placeholder="Naam" placeholderTextColor={theme.colors.textSecondary} />
      <TextInput style={styles.inputV2} value={newEmail} onChangeText={setNewEmail}
                 placeholder="Email (optioneel)" placeholderTextColor={theme.colors.textSecondary}
                 keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.inputV2} value={newPhone} onChangeText={setNewPhone}
                 placeholder="Telefoon (optioneel)" placeholderTextColor={theme.colors.textSecondary}
                 keyboardType="phone-pad" />

      {/* Profiel chips — zelfde als regels 947-976 maar met nieuwe chip-stijl */}
      <Text style={styles.sheetLabel}>PROFIEL</Text>
      <View style={styles.chipsRowV2}>
        {ALL_JOB_TYPES.map(jt => (
          <TouchableOpacity
            key={jt}
            style={[styles.chipV2, newJobType === jt && styles.chipV2Active]}
            onPress={() => setNewJobType(jt)}
          >
            <Text style={[
              styles.chipV2Text,
              newJobType === jt && styles.chipV2TextActive,
            ]}>
              {JOB_LABELS[jt]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Discipline preview + project-selectie blokken (zelfde logica, regels 978-1037) */}

      {/* Bottom actie-rij */}
      <View style={styles.sheetActions}>
        <TouchableOpacity
          style={styles.sheetCancelBtn}
          onPress={() => setShowAddForm(false)}
          disabled={adding}
        >
          <Text style={styles.sheetCancelText}>Annuleer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetPrimaryBtn, adding && { opacity: 0.6 }]}
          onPress={() => void handleAddMember()}
          disabled={adding}
        >
          {adding ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.sheetPrimaryText}>Aanmaken & uitnodigen</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </View>
) : null}
```

Styles:

```ts
sheetBackdrop: {
  position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(40,30,20,0.4)',
  alignItems: 'center', justifyContent: 'center',
  padding: 20, zIndex: 50,
},
sheetCard: {
  width: '100%', maxWidth: 520,
  maxHeight: '90%',
  borderRadius: 18, padding: 24,
  gap: 12,
},
sheetHeader: {
  flexDirection: 'row', alignItems: 'center',
  justifyContent: 'space-between',
},
sheetTitle: {
  fontSize: 22, fontWeight: '700',
  color: theme.colors.textPrimary,
  letterSpacing: -0.4,
},
sheetCloseBtn: {
  width: 32, height: 32, borderRadius: 16,
  backgroundColor: 'rgba(120,90,70,0.08)',
  alignItems: 'center', justifyContent: 'center',
},
sheetCloseText: { fontSize: 14, color: theme.colors.textSecondary },
sheetSubtitle: {
  fontSize: 13, color: theme.colors.textSecondary,
  marginBottom: 8,
},
sheetLabel: {
  fontSize: 10, fontWeight: '700', letterSpacing: 2,
  color: theme.colors.textSecondary,
  marginTop: 14, marginBottom: 8,
},
inputV2: {
  borderWidth: 1, borderRadius: 10,
  borderColor: 'rgba(120,90,70,0.15)',
  paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 14,
  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(250,245,240,0.5)',
  color: theme.colors.textPrimary,
},
chipsRowV2: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
chipV2: {
  paddingHorizontal: 12, paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: 'rgba(120,90,70,0.15)',
  backgroundColor: 'transparent',
},
chipV2Active: {
  borderColor: theme.colors.textPrimary,
  backgroundColor: theme.colors.textPrimary,
},
chipV2Text: {
  fontSize: 12, fontWeight: '600',
  color: theme.colors.textSecondary,
},
chipV2TextActive: { color: theme.colors.background },
sheetActions: {
  flexDirection: 'row', gap: 10, marginTop: 16,
},
sheetCancelBtn: {
  paddingHorizontal: 18, paddingVertical: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(120,90,70,0.2)',
  alignItems: 'center', justifyContent: 'center',
},
sheetCancelText: {
  fontSize: 14, fontWeight: '600',
  color: theme.colors.textSecondary,
},
sheetPrimaryBtn: {
  flex: 1, paddingVertical: 12,
  borderRadius: 12,
  backgroundColor: theme.colors.textPrimary,
  alignItems: 'center', justifyContent: 'center',
},
sheetPrimaryText: {
  color: theme.colors.background,
  fontSize: 14, fontWeight: '700',
  letterSpacing: 0.3,
},
```

**Verwijder** de oude `+ Vakman toevoegen` button onderaan (regels 1066-1078) — die wordt vervangen door de primary CTA in de top-bar (sectie B).

---

### E. Import toevoegen

Boven in het bestand bij de RN imports (regel 11-23):

```ts
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,       // ← TOEVOEGEN
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
```

---

## Bouwvolgorde voor verse sessie

```
1. Open verse Claude Code sessie in worktree:
   cd /Users/johnnyspee/Desktop/SpeeSolutions\ Projects/Project\ 4\ WKB/speeq

2. Eerste prompt aan Claude:
   "Lees /Users/johnnyspee/Desktop/SpeeSolutions Projects/Project 4 WKB/speeq/REDESIGN_TEAMBEHEER.md
    en voer secties A t/m E uit op frontend/src/screens/TeamBeheerScreen.tsx.
    Behoud ALLE bestaande logica (data-fetch, save, state). Verander alleen render + styles."

3. Na implementatie: npx tsc --noEmit (geen errors)

4. Visuele check lokaal: npm run web → /admin tab

5. Deploy: cd frontend && npx vercel --prod --yes
   Alias updaten: npx vercel alias set <new-url> speeq-wkb-tool.vercel.app
```

---

## Wat NIET aanpassen (logica blijft 1-op-1)

- `loadMembers`, `handleSaveMember`, `handleAddMember`
- Invite-token generatie + WhatsApp share + clipboard copy
- `editingId`, `qrMemberId`, `editProjectIds` state-management
- QR-panel render (regels 594-684) — werkt prima
- Edit-panel render (regels 686-861) — werkt prima
- Tab-switcher zelf (regels 425-443)
- `BevoegdhedenBord` component import en gebruik

---

## Wat de demo straks laat zien

1. **/maker** — clean lijst van klanten, "Open als klant" werkt
2. **In Combivo workspace** — header heeft Combivo-branding
3. **Sidebar → Modules** — feature-toggles aan/uit met 1 klik
4. **Sidebar → Team Beheer** — *nieuwe* premium-look (na implementatie)
5. **Mobiel** — vakman scant QR → komt direct in z'n eigen profiel

Investeerder ziet: drie-laagse SaaS-architectuur die werkt, niet alleen een mockup.

---

*Versie 1.0 · Voor verse sessie · Johnny voert plan uit, Claude bouwt.*
