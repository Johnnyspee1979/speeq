# DSO‑LV Integratie (Digikoppeling) – Architectuur

## Doel
Deze laag levert STAM‑meldingen veilig af bij de DSO‑LV via een Digikoppeling‑adapter (DKA). We bouwen **nooit** Digikoppeling zelf, maar integreren met een gecertificeerde adapter.

## Stroomschema (hoog niveau)
1. **Data aggregatie** in backend (borgingsplan, bewijs, risicobeoordeling).
2. **Mapping** naar STAM‑payload (JSON/XML).
3. **Adapter submit** (PKIoverheid‑auth, signing, reliable messaging).
4. **Status/ack** ophalen via adapter.

## Backend stubs
- `POST /api/dso/stam/submit` → map naar STAM, lever aan adapter.
- `GET /api/dso/stam/status/:referenceId` → status ophalen.

## Config (env)
- `DSO_ADAPTER_URL` (endpoint van adapter)
- `DSO_ADAPTER_CLIENT_ID`
- `DSO_ADAPTER_CERT_ALIAS`
- `DSO_ENV` (LTO | PREPROD | PROD)

## Testtraject
1. **LTO** (leveranciers testomgeving)
2. **Pre‑prod** (test meldingen met log‑bewijzen)
3. **Prod** (live meldingen)

## Leveranciers (buy vs build)
Kies een gecertificeerde DKA‑leverancier en integreer via hun API. Bouw Digikoppeling niet zelf.
