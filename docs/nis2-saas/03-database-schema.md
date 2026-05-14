# SpeeSolutions NIS2 Compliance Dashboard — Database Schema & RLS (MVP v1.0)

> **Status:** Draft v0.1 — ontwerp-document, **niet** runnable migratie (wordt SQL-bestand zodra echte repo bestaat)
> **Doel:** complete Postgres-DDL + RLS-policies + tenant-isolation test-cases voor MVP
> **Belangrijkste principe:** *RLS is de enige echte tenant-boundary. Eén bug = einde bedrijf.*

---

## 0. Aannames

- Supabase Postgres 15+, EU-region (`eu-central-1` Frankfurt)
- `auth.users` (Supabase managed) bestaat al
- `auth.uid()` retourneert UUID van ingelogde user, of `NULL` voor anon
- App-role = `authenticated`. Service-role-key blijft server-side, gebruikt `service_role`.
- `pgcrypto`, `pgsodium`, `pgjwt`, `uuid-ossp` extensions actief (Supabase default)

## 1. Naming-conventies

| Wat | Regel |
|---|---|
| Tabellen | `snake_case`, plural (`organizations`, `assessments`) |
| Kolommen | `snake_case`, single (`organization_id`, `created_at`) |
| Primary keys | `id uuid DEFAULT gen_random_uuid() PRIMARY KEY` |
| Foreign keys | `<tabel_enkelvoud>_id` |
| Timestamps | `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at` idem |
| Soft-delete | `deleted_at timestamptz` (alleen waar nodig — `organizations` + `users`) |
| Booleans | positief geformuleerd (`is_active`, `evidence_required`) |
| Enums | Postgres-enum types met `_status` of `_role` suffix |

## 2. Enums

```sql
CREATE TYPE membership_role AS ENUM (
  'owner',
  'admin',
  'contributor',
  'viewer'
);

CREATE TYPE assessment_response_status AS ENUM (
  'not_started',
  'in_progress',
  'implemented',
  'not_applicable'
);

CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'revoked',
  'expired'
);
```

## 3. Tabellen — DDL

### 3.1 `organizations`

```sql
CREATE TABLE public.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  kvk_number      text CHECK (kvk_number ~ '^\d{8}$'),  -- NL KvK = 8 cijfers
  plan_id         text NOT NULL DEFAULT 'free',
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX idx_organizations_deleted_at ON public.organizations(deleted_at) WHERE deleted_at IS NULL;
```

### 3.2 `memberships`

```sql
CREATE TABLE public.memberships (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role              membership_role NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX idx_memberships_org ON public.memberships(organization_id);
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
```

**Eis:** ten minste 1 `owner` per organisatie. Geforceerd via trigger (zie §5).

### 3.3 `frameworks`

```sql
CREATE TABLE public.frameworks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,                        -- 'NIS2', 'ISO27001_LITE'
  version         text NOT NULL,                        -- 'v1.0'
  title           text NOT NULL,
  description_md  text,
  published_at    timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (code, version)
);
```

Geen `organization_id` — frameworks zijn globaal/publiek.

### 3.4 `framework_controls`

```sql
CREATE TABLE public.framework_controls (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        uuid NOT NULL REFERENCES public.frameworks(id) ON DELETE CASCADE,
  code                text NOT NULL,                    -- 'A21.1.a', 'A.5.1'
  title               text NOT NULL,
  description_md      text NOT NULL,
  category            text NOT NULL,                    -- 'Risicobeheersing', 'Incidentbeheer', etc.
  guidance_md         text,
  evidence_required   boolean NOT NULL DEFAULT false,
  display_order       integer NOT NULL DEFAULT 0,
  UNIQUE (framework_id, code)
);

CREATE INDEX idx_controls_framework ON public.framework_controls(framework_id, display_order);
```

### 3.5 `assessments`

```sql
CREATE TABLE public.assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  framework_id      uuid NOT NULL REFERENCES public.frameworks(id) ON DELETE RESTRICT,
  title             text NOT NULL,
  current_step      integer NOT NULL DEFAULT 0,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessments_org ON public.assessments(organization_id);
CREATE INDEX idx_assessments_framework ON public.assessments(framework_id);
```

### 3.6 `assessment_responses`

```sql
CREATE TABLE public.assessment_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  control_id        uuid NOT NULL REFERENCES public.framework_controls(id) ON DELETE RESTRICT,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status            assessment_response_status NOT NULL DEFAULT 'not_started',
  maturity_level    smallint CHECK (maturity_level BETWEEN 0 AND 5),
  notes_md          text,
  answered_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, control_id)
);

CREATE INDEX idx_responses_assessment ON public.assessment_responses(assessment_id);
CREATE INDEX idx_responses_org ON public.assessment_responses(organization_id);
```

**Belangrijk:** `organization_id` is gedenormaliseerd voor 1-level RLS. Geforceerd consistent via trigger (zie §5).

### 3.7 `evidence_files`

```sql
CREATE TABLE public.evidence_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id       uuid NOT NULL REFERENCES public.assessment_responses(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path      text NOT NULL UNIQUE,               -- UUID-based path, niet user-controlled
  original_filename text NOT NULL CHECK (length(original_filename) <= 255),
  mime_type         text NOT NULL,
  size_bytes        bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),  -- 20 MB cap
  sha256            text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (mime_type IN (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ))
);

CREATE INDEX idx_evidence_response ON public.evidence_files(response_id);
CREATE INDEX idx_evidence_org ON public.evidence_files(organization_id);
CREATE INDEX idx_evidence_sha ON public.evidence_files(sha256);
```

### 3.8 `reports`

```sql
CREATE TABLE public.reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path      text NOT NULL UNIQUE,
  hash_sha256       text NOT NULL CHECK (hash_sha256 ~ '^[a-f0-9]{64}$'),
  template_version  text NOT NULL,
  generated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_assessment ON public.reports(assessment_id);
CREATE INDEX idx_reports_org ON public.reports(organization_id);
CREATE INDEX idx_reports_hash ON public.reports(hash_sha256);
```

### 3.9 `audit_log`

```sql
CREATE TABLE public.audit_log (
  id                bigserial PRIMARY KEY,
  organization_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action            text NOT NULL,
  target_type       text,
  target_id         text,
  ip_address        inet,
  user_agent        text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org_time ON public.audit_log(organization_id, occurred_at DESC);
CREATE INDEX idx_audit_actor_time ON public.audit_log(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_action ON public.audit_log(action);
```

**Append-only enforcement:** UPDATE/DELETE-rechten voor app-user expliciet revoken (§6).

### 3.10 `invitations`

```sql
CREATE TABLE public.invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email             text NOT NULL CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  role              membership_role NOT NULL,
  token_hash        text NOT NULL UNIQUE,               -- SHA256 van de echte token; token zelf alleen in mail
  status            invitation_status NOT NULL DEFAULT 'pending',
  invited_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at        timestamptz NOT NULL,
  accepted_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX idx_invitations_email ON public.invitations(lower(email));
```

**Token-beveiliging:** alleen de hash in DB. Verificatie via `digest(input_token, 'sha256') = token_hash`.

## 4. RLS-policies

**Globale regel:** RLS aan op **élke** tabel, geen uitzonderingen.

```sql
ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frameworks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.framework_controls     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations            ENABLE ROW LEVEL SECURITY;
```

### Helper-functie (SECURITY DEFINER, leesbaar)

```sql
CREATE OR REPLACE FUNCTION public.user_organizations()
RETURNS TABLE (organization_id uuid, role membership_role)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT m.organization_id, m.role
  FROM public.memberships m
  WHERE m.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.user_organizations() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_organizations() TO authenticated;
```

**Waarom SECURITY DEFINER:** memberships zelf staat onder RLS; zonder definer-functie krijg je circulaire policy-evaluatie. `STABLE` zodat Postgres het kan cachen binnen één statement.

### 4.1 `organizations`

```sql
-- SELECT: alle leden van de org
CREATE POLICY org_select ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM public.user_organizations()));

-- INSERT: iedereen mag een nieuwe org aanmaken (worden owner)
CREATE POLICY org_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: alleen owner/admin
CREATE POLICY org_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT organization_id FROM public.user_organizations() WHERE role IN ('owner', 'admin')))
  WITH CHECK (id IN (SELECT organization_id FROM public.user_organizations() WHERE role IN ('owner', 'admin')));

-- DELETE: alleen owner (soft-delete eigenlijk; hard-delete via service-role)
CREATE POLICY org_delete ON public.organizations
  FOR DELETE TO authenticated
  USING (id IN (SELECT organization_id FROM public.user_organizations() WHERE role = 'owner'));
```

### 4.2 `memberships`

```sql
-- SELECT: zien wie er in jouw orgs zit
CREATE POLICY mem_select ON public.memberships
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()));

-- INSERT: alleen owner/admin van die org mag toevoegen
CREATE POLICY mem_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations() WHERE role IN ('owner', 'admin')));

-- UPDATE (role wijzigen): alleen owner
CREATE POLICY mem_update ON public.memberships
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations() WHERE role = 'owner'))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations() WHERE role = 'owner'));

-- DELETE: owner (anderen verwijderen) OF eigen lidmaatschap
CREATE POLICY mem_delete ON public.memberships
  FOR DELETE TO authenticated
  USING (
    (organization_id IN (SELECT organization_id FROM public.user_organizations() WHERE role = 'owner'))
    OR (user_id = auth.uid())
  );
```

**Trigger-eis:** laatste owner mag niet verwijderd worden (zie §5).

### 4.3 `frameworks` + `framework_controls`

```sql
-- Globaal leesbaar voor authenticated; alleen service-role mag schrijven
CREATE POLICY fw_select ON public.frameworks
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY fwc_select ON public.framework_controls
  FOR SELECT TO authenticated
  USING (framework_id IN (SELECT id FROM public.frameworks WHERE is_active = true));

-- Geen INSERT/UPDATE/DELETE policies voor authenticated = alle writes geweigerd voor app-user
```

### 4.4 `assessments`, `assessment_responses`, `evidence_files`, `reports`

Patroon voor alle vier dezelfde structuur — voorbeeld `assessments`:

```sql
CREATE POLICY assessments_select ON public.assessments
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()));

CREATE POLICY assessments_insert ON public.assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.user_organizations()
                        WHERE role IN ('owner', 'admin', 'contributor'))
    AND created_by = auth.uid()
  );

CREATE POLICY assessments_update ON public.assessments
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()
                             WHERE role IN ('owner', 'admin', 'contributor')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations()
                                  WHERE role IN ('owner', 'admin', 'contributor')));

CREATE POLICY assessments_delete ON public.assessments
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()
                             WHERE role IN ('owner', 'admin')));
```

**Voor `assessment_responses`, `evidence_files`, `reports`:** zelfde patroon, met daarbij voor INSERT/UPDATE een **dubbele check** dat het `assessment_id`/`response_id` daadwerkelijk bij dezelfde organisatie hoort (zie §5 trigger).

### 4.5 `audit_log`

```sql
-- SELECT: alleen audit van eigen orgs
CREATE POLICY audit_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()
                             WHERE role IN ('owner', 'admin')));

-- INSERT: alleen via SECURITY DEFINER functie (geen directe insert)
-- (geen INSERT-policy = geen direct insert mogelijk voor authenticated)

-- UPDATE/DELETE: nooit (geen policies = niets toegestaan)
```

```sql
CREATE OR REPLACE FUNCTION public.log_audit(
  p_organization_id uuid,
  p_action          text,
  p_target_type     text DEFAULT NULL,
  p_target_id       text DEFAULT NULL,
  p_metadata        jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authz check: caller moet lid zijn van p_organization_id (of NULL voor systeem-events)
  IF p_organization_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.memberships
       WHERE user_id = auth.uid() AND organization_id = p_organization_id
     )
  THEN
    RAISE EXCEPTION 'not a member of organization %', p_organization_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_log (
    organization_id, actor_user_id, action, target_type, target_id, metadata,
    ip_address, user_agent
  )
  VALUES (
    p_organization_id, auth.uid(), p_action, p_target_type, p_target_id, p_metadata,
    NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', '')::inet,
    NULLIF(current_setting('request.headers', true)::jsonb->>'user-agent', '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_audit TO authenticated;
```

### 4.6 `invitations`

```sql
CREATE POLICY inv_select ON public.invitations
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()
                             WHERE role IN ('owner', 'admin')));

CREATE POLICY inv_insert ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_organizations()
                                  WHERE role IN ('owner', 'admin'))
              AND invited_by = auth.uid());

CREATE POLICY inv_update ON public.invitations
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_organizations()
                             WHERE role IN ('owner', 'admin')));

-- Accept-flow loopt via SECURITY DEFINER functie (token-hash verificatie)
```

## 5. Triggers (consistentie + invariants)

### 5.1 Forceer denormalized `organization_id` consistent met parent

```sql
CREATE OR REPLACE FUNCTION public.tg_check_response_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assessment_org uuid;
BEGIN
  SELECT organization_id INTO v_assessment_org
  FROM public.assessments
  WHERE id = NEW.assessment_id;

  IF v_assessment_org IS NULL THEN
    RAISE EXCEPTION 'assessment % not found', NEW.assessment_id;
  END IF;

  IF NEW.organization_id <> v_assessment_org THEN
    RAISE EXCEPTION 'organization_id mismatch: response=% vs assessment=%',
      NEW.organization_id, v_assessment_org
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_responses_org
BEFORE INSERT OR UPDATE OF assessment_id, organization_id
ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION public.tg_check_response_org();
```

Identieke triggers voor `evidence_files` (check `response_id` → `assessment_id` → `org`) en `reports`.

### 5.2 Eerste user wordt automatisch owner

```sql
CREATE OR REPLACE FUNCTION public.tg_org_default_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.memberships (user_id, organization_id, role)
  VALUES (NEW.created_by, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_default_owner
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.tg_org_default_owner();
```

### 5.3 Laatste owner mag niet verwijderd worden

```sql
CREATE OR REPLACE FUNCTION public.tg_protect_last_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_owners_left integer;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT count(*) INTO v_owners_left
    FROM public.memberships
    WHERE organization_id = OLD.organization_id AND role = 'owner';

    IF v_owners_left <= 1 THEN
      RAISE EXCEPTION 'cannot remove last owner of organization';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT count(*) INTO v_owners_left
    FROM public.memberships
    WHERE organization_id = OLD.organization_id AND role = 'owner';

    IF v_owners_left <= 1 THEN
      RAISE EXCEPTION 'cannot demote last owner of organization';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_protect_last_owner
BEFORE UPDATE OR DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_last_owner();
```

### 5.4 `updated_at` auto-touch

```sql
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Apply on: organizations, assessments, assessment_responses
CREATE TRIGGER trg_touch_orgs BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
-- ... idem voor de andere
```

## 6. Permissies — expliciet

```sql
-- App-user (authenticated): geen DDL, geen TRUNCATE, geen sequences direct
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT  SELECT                          ON public.frameworks, public.framework_controls TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.assessment_responses TO authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.evidence_files TO authenticated;
GRANT  SELECT, INSERT                  ON public.reports TO authenticated;  -- geen UPDATE/DELETE
GRANT  SELECT                          ON public.audit_log TO authenticated;  -- alleen lezen
GRANT  SELECT, INSERT, UPDATE          ON public.invitations TO authenticated; -- geen DELETE

-- Sequences (voor audit_log.id)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Anon-rol krijgt NIETS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
```

**Belangrijk:** Supabase's default GRANT bij `CREATE TABLE` is breed. Bovenstaande REVOKE-eerst-GRANT-precies is **niet onderhandelbaar**.

## 7. Storage policies (Supabase Storage)

Bucket: `evidence` (private), `reports` (private).

```sql
-- evidence-bucket: alleen leden van de org mogen down/uploaden
CREATE POLICY "evidence_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id::text FROM public.user_organizations()
    )
  );

CREATE POLICY "evidence_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id::text FROM public.user_organizations()
      WHERE role IN ('owner', 'admin', 'contributor')
    )
  );

-- DELETE alleen owner/admin
CREATE POLICY "evidence_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidence'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id::text FROM public.user_organizations()
      WHERE role IN ('owner', 'admin')
    )
  );
```

**Storage path convention:** `<organization_id>/<assessment_id>/<response_id>/<file_uuid>.<ext>`. Origineel filename **niet** in path (zie threat-model T4).

## 8. Tenant-isolation test-suite

Dit is de **belangrijkste test** in de hele MVP. Draait bij elke PR. Faalt = blokkeert merge.

### 8.1 Fixture-opzet

```sql
-- Twee tenants + twee users (via Supabase Auth seed)
-- user_a → org_a (owner)
-- user_b → org_b (owner)

-- Vul org_a met representatieve data
INSERT INTO assessments (id, organization_id, framework_id, title, created_by)
  VALUES ('11111111-...', 'org_a_id', 'fw_id', 'A test', 'user_a_id');
-- + responses, evidence_files, reports, audit_log voor org_a
```

### 8.2 Test-cases (allen MOETEN falen vanuit user_b's sessie)

```sql
-- Set JWT to user_b
SET request.jwt.claim.sub = 'user_b_id';
SET ROLE authenticated;

-- T1: org_a niet zichtbaar
SELECT count(*) FROM organizations WHERE id = 'org_a_id';  -- expect 0

-- T2: memberships van org_a niet zichtbaar
SELECT count(*) FROM memberships WHERE organization_id = 'org_a_id';  -- expect 0

-- T3: assessments van org_a niet zichtbaar
SELECT count(*) FROM assessments WHERE organization_id = 'org_a_id';  -- expect 0

-- T4: kan geen response invoegen in org_a's assessment
INSERT INTO assessment_responses (assessment_id, control_id, organization_id, status)
  VALUES ('org_a_assessment_id', 'control_id', 'org_a_id', 'implemented');
-- expect: ERROR (policy violation)

-- T5: kan org_a's response niet updaten
UPDATE assessment_responses SET notes_md = 'pwn' WHERE organization_id = 'org_a_id';
-- expect: 0 rows affected (RLS filtert weg)

-- T6: organisation_id-spoof — eigen org maar response_id van andere org
INSERT INTO evidence_files (response_id, organization_id, storage_path, original_filename, mime_type, size_bytes, sha256)
  VALUES ('org_a_response_id', 'org_b_id', 'org_b_id/...', 'x.pdf', 'application/pdf', 100, '00'||repeat('0', 62));
-- expect: ERROR via trigger tg_check_response_org

-- T7: storage path traversal
SELECT * FROM storage.objects WHERE name LIKE 'org_a_id/%';  -- expect 0

-- T8: kan audit_log van org_a niet lezen
SELECT count(*) FROM audit_log WHERE organization_id = 'org_a_id';  -- expect 0

-- T9: kan audit_log niet schrijven via INSERT (policy-loos)
INSERT INTO audit_log (organization_id, action) VALUES ('org_a_id', 'pwn');
-- expect: ERROR (no INSERT policy)

-- T10: kan log_audit() functie niet misbruiken voor andere org
SELECT log_audit('org_a_id'::uuid, 'pwn');
-- expect: ERROR 42501 (not a member)

-- T11: laatste owner verwijderen geblokkeerd
SET request.jwt.claim.sub = 'user_a_id';
DELETE FROM memberships WHERE user_id = 'user_a_id' AND organization_id = 'org_a_id';
-- expect: ERROR (cannot remove last owner)

-- T12: framework-tabel writes geweigerd
INSERT INTO frameworks (code, version, title) VALUES ('PWN', 'v1', 'p');
-- expect: ERROR (no INSERT policy for authenticated)
```

Test-runner: pgTAP of plain SQL in een CI-step die exit-code = 1 zet bij elke onverwachte uitkomst.

### 8.3 Negative & positive samen

Voor **élke** test in §8.2 die voor user_b moet falen, draait ook een spiegel-test voor user_a die **moet** slagen — anders weet je niet of de policy te streng staat.

## 9. Wat NIET in dit schema zit (bewust)

- **Billing-tabellen:** Stripe is source of truth, MVP volgt later.
- **SSO/SAML mapping:** geen enterprise in MVP.
- **API-keys:** geen externe API in v1.0.
- **Phishing-simulatie tabellen** (campaigns, recipients, click-events): fase 2.
- **Real-time presence:** Supabase Realtime niet gebruikt; standaard REST is genoeg.
- **Encrypted columns met pgsodium:** evidence-files zijn al encrypted at rest via storage. PII in DB is minimaal. Geen extra applicatie-laag-crypto in MVP.

## 10. Migratie-strategie (zodra echte repo bestaat)

- Eén initiële migratie: `0001_init.sql` met alles uit §2–§7.
- Tweede migratie: `0002_seed_frameworks.sql` met NIS2-controls + ISO27001-subset.
- Géén `IF NOT EXISTS` — strikte forward-only migraties.
- CI test rolt fresh DB op, draait migraties, draait tenant-isolation tests.

## 11. Open vragen bij dit schema

1. **Framework-versionering bij wijziging:** wat doen we met `assessment_responses` als een control wordt aangepast in een nieuwe framework-versie? Voorstel: assessments zijn immutable gekoppeld aan **versie** van framework; nieuwe versie = nieuwe assessment.
2. **Soft-delete vs hard-delete** voor `organizations`: ik heb soft-delete-kolom toegevoegd maar geen RLS-filter. Beslissen bij implementatie.
3. **`audit_log` retentie**: 7 jaar = veel rijen. Bij groei: partitioneren per kwartaal. Niet in MVP nodig.
4. **`evidence_files.size_bytes` cap op 20 MB:** voldoende voor MKB-bewijs (PDF-beleid, screenshot). Bij eerste klantvraag heroverwegen.
5. **Invitation token-encoding:** voorstel 32 bytes random → base64url in mail, SHA256-hash in DB. Bevestigen.

---

*Vorige deliverables:* `01-architecture.md`, `02-threat-model.md`
*Volgende deliverable:* UX-flow + screen-inventaris voor MVP (`04-ux-flows.md`) of CI-pipeline-yaml als doc (`04-ci-pipeline.md`) — welke wil CEO eerst?
