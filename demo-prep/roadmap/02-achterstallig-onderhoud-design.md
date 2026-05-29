# Achterstallig Onderhoud — Module Design

> Voor Combivo's MJOP-cyclus en RGS-projecten. Toont per pand welke onderhoudsitems overdue zijn.

---

## Concept

Een onderhoudsbedrijf zoals Combivo werkt met **MJOP (Meerjaren Onderhouds Plan)** waarin per pand staat:
- Welke onderhouds-items er zijn (kozijnen schilderen, dakgoten reinigen, voegwerk, etc.)
- Met welke frequentie (jaarlijks / 2-jaarlijks / 5-jaarlijks)
- Wanneer voor het laatst gedaan
- Wanneer de **volgende** keer gepland staat

**Achterstallig** = items waarvan `due_date < NOW()` en `status != 'completed'`.

**SpeeQ's rol:** dashboard dat per pand/project laat zien wat overdue is, met directe link naar foto-vastlegging zodra het werk gedaan is.

---

## Schema-toevoeging

We gebruiken `project_checklists` als basis en breiden uit. Bestaat al:
```
id (bigint), project_id (text), checklist_type (text), item_id (text),
title (text), checked (boolean), updated_at, user_id, created_at, tenant_id
```

Nieuwe migratie `004_achterstallig_onderhoud.sql`:

```sql
-- Velden voor MJOP-cyclus
ALTER TABLE public.project_checklists 
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_months integer,
  ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('laag','medium','hoog','kritiek')),
  ADD COLUMN IF NOT EXISTS estimated_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS discipline_id text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Index voor dashboard query
CREATE INDEX IF NOT EXISTS idx_checklist_due_date 
  ON public.project_checklists(due_date, checked) 
  WHERE checked = false;

-- View: alle achterstallige items per tenant
CREATE OR REPLACE VIEW public.v_achterstallig_onderhoud AS
SELECT 
  pc.id,
  pc.tenant_id,
  pc.project_id,
  p.name AS project_name,
  p.address AS project_address,
  pc.checklist_type,
  pc.title,
  pc.priority,
  pc.due_date,
  pc.last_completed_at,
  pc.discipline_id,
  pc.responsible_user_id,
  profiles.full_name AS responsible_name,
  EXTRACT(DAY FROM NOW() - pc.due_date)::int AS days_overdue
FROM public.project_checklists pc
JOIN public.projects p ON p.id = pc.project_id
LEFT JOIN public.profiles ON profiles.id = pc.responsible_user_id
WHERE pc.checked = false
  AND pc.due_date IS NOT NULL
  AND pc.due_date < NOW()
ORDER BY pc.priority DESC, pc.due_date ASC;

-- Functie: na voltooien automatisch volgende cyclus inplannen
CREATE OR REPLACE FUNCTION public.checklist_complete_and_reschedule(
  p_checklist_id bigint
) RETURNS void AS $$
DECLARE
  v_item RECORD;
BEGIN
  SELECT * INTO v_item FROM public.project_checklists WHERE id = p_checklist_id;
  
  UPDATE public.project_checklists 
    SET checked = true, 
        last_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_checklist_id;
  
  -- Plan volgende ronde in als er een recurrence is
  IF v_item.recurrence_months IS NOT NULL AND v_item.recurrence_months > 0 THEN
    INSERT INTO public.project_checklists (
      project_id, checklist_type, item_id, title,
      due_date, recurrence_months, priority,
      discipline_id, tenant_id
    ) VALUES (
      v_item.project_id, v_item.checklist_type, v_item.item_id, v_item.title,
      NOW() + (v_item.recurrence_months || ' months')::interval,
      v_item.recurrence_months, v_item.priority,
      v_item.discipline_id, v_item.tenant_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## UI · Achterstallig Dashboard

Twee schermen:

### 1. Overzichtsdashboard (projectleider / DGA)

```
┌─────────────────────────────────────────────────────────┐
│ Achterstallig onderhoud — Combivo Vastgoedonderhoud     │
│                                                         │
│ KPI cards:                                              │
│ [Kritiek: 3]  [Hoog: 12]  [Medium: 24]  [Totaal: 47]   │
│                                                         │
│ Filter: ▼ Discipline   ▼ Pand   ▼ Verantwoordelijke    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Pand: Hoofdstraat 12, Den Haag                      │ │
│ │ ─── 🔴 Kozijnen schilderen — 23 dagen overdue       │ │
│ │     Verantwoordelijke: Jan de Vries                 │ │
│ │     [Plannen] [Foto maken] [Notitie]                │ │
│ │ ─── 🟡 Dakgoot reinigen — 8 dagen overdue           │ │
│ │     ...                                              │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Pand: Stationsweg 45, Rotterdam                     │ │
│ │ ─── 🔴 Voegwerk gevel — 41 dagen overdue            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [+ Item handmatig toevoegen]  [⬇ Excel-export]         │
└─────────────────────────────────────────────────────────┘
```

### 2. Vakman dagplanning (mobile)

Toont items waarvan vakman responsible is, gesorteerd op prioriteit:
- Tap → opent capture-flow (`QuickCaptureView` met pre-filled `inspection_point_id`)
- Na foto + AI-validatie → `checklist_complete_and_reschedule()` aanroepen

---

## Bulk-import voor Combivo

Combivo heeft hun MJOP waarschijnlijk in Excel. We bouwen een import:

```
Upload Excel met kolommen:
  pand_naam | inspectie_punt | discipline | cyclus_maanden | laatste_uitvoering | prioriteit

→ converteert naar inserts in project_checklists
```

Endpoint: `POST /api/import/mjop` met multipart/form-data.
Frontend: bestaande Maker-paneel uitbreiden.

---

## Combivo-relevantie

Waarom dit voor Combivo gold is:
1. **Werken voor corporaties** → corporatie wil bewijs dat onderhoud cyclisch gebeurt
2. **Meestersgilde flexpool** → wisselende vakmensen, kennis verdwijnt — checklist hangt aan het pand niet aan de persoon
3. **MJOP-rapportage** → corporatie eist jaarlijks overzicht — uit deze data direct te genereren

---

## Wat te bouwen in M2/M4

| Volgorde | Onderdeel | Tijd-schatting |
|---|---|---|
| M2 dag 1 | Migration draft + view + functie | 2 uur |
| M2 dag 1 | HTML mock van achterstallig-dashboard | 1 uur |
| M4 dag 4 | React component voor dashboard | 4 uur |
| M4 dag 4 | React Native screen voor vakman-dagplanning | 3 uur |
| M5 dag 5 | Excel-import endpoint + UI | 3 uur |

Totaal: ~13 uur ontwikkelwerk verspreid over de week.

---

## Wat ik aan jou nodig heb voor M2

- **Akkoord op de schema-uitbreiding** (voeg ik kolommen toe of liever nieuwe tabel `maintenance_items`?)
- **Voorbeeld-MJOP** van Combivo of vergelijkbaar (al 5 rijen helpt het ontwerp)
- **UX-akkoord** op dashboard-layout (kleine wijzigingen kunnen we in mock-up doen)
