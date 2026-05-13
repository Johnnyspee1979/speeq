# 09 — Spec: Wachtwoord vergeten + e-mail bevestiging

> Kant-en-klare implementatie-spec.
> Doel: klant die wachtwoord kwijt is komt zélf weer binnen, zonder support-mail naar Johnny.
> Geschatte tijd: 60–90 min in een verse Claude-sessie.

## Wat de klant straks ziet

1. Op `/?t=jansen` ziet klant het login-scherm met e-mail + wachtwoord.
2. Onder het wachtwoord-veld staat: **"Wachtwoord vergeten?"**
3. Klant klikt → vult e-mailadres in → krijgt mail van Supabase
4. Klant klikt op link in mail → komt op `/reset-password.html?t=jansen` met recovery-token
5. Klant vult 2× nieuw wachtwoord in → klikt "Wachtwoord opslaan"
6. Klant wordt automatisch teruggestuurd naar `/?t=jansen` en kan direct inloggen

## De drie bestanden die aangepast/aangemaakt moeten worden

### 1. `frontend/src/screens/LoginScreen.tsx` — voeg knop toe

**Zoek** het wachtwoord-`TextInput` in het bestand. Direct onder de wachtwoord-`View` toevoegen:

```tsx
<TouchableOpacity
  onPress={handleForgotPassword}
  style={{ alignSelf: 'flex-end', marginTop: 8, marginBottom: 16 }}
>
  <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>
    Wachtwoord vergeten?
  </Text>
</TouchableOpacity>
```

**Voeg toe** als nieuwe handler-functie in de component (boven `return`):

```tsx
const handleForgotPassword = async () => {
  if (!email || !email.includes('@')) {
    Alert.alert('E-mail nodig', 'Vul eerst je e-mailadres in voordat je op "Wachtwoord vergeten" klikt.');
    return;
  }

  try {
    // Slug uit URL halen voor redirect terug naar juiste tenant
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('t') || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = `${origin}/reset-password.html${slug ? `?t=${slug}` : ''}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;

    Alert.alert(
      'Mail verstuurd',
      `Check je inbox van ${email}. Klik op de link om een nieuw wachtwoord in te stellen.`
    );
  } catch (err: any) {
    Alert.alert('Iets ging mis', err?.message ?? 'Probeer het opnieuw of mail support.');
  }
};
```

**Imports check** bovenaan het bestand — moet aanwezig zijn:
- `Alert` uit `react-native`
- `TouchableOpacity`, `Text` uit `react-native`
- `supabase` uit het al gebruikte pad (waarschijnlijk `'../lib/supabase'`)

### 2. `frontend/web/reset-password.html` — nieuw bestand aanmaken

> **Let op:** NIET de bestaande `frontend/web/reset.html` overschrijven — dat is de cache-clear-pagina.
> Maak een nieuw bestand `reset-password.html` ernaast.

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Wachtwoord opnieuw instellen — SpeeQ</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p.sub { color: #64748b; font-size: 14px; margin: 0 0 24px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #334155; }
    input {
      width: 100%;
      padding: 12px 14px;
      font-size: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      margin-bottom: 16px;
      outline: none;
    }
    input:focus { border-color: #2563eb; }
    button {
      width: 100%;
      padding: 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .msg { padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .msg.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .msg.ok { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Nieuw wachtwoord instellen</h1>
    <p class="sub">Vul tweemaal je nieuwe wachtwoord in. Daarna log je opnieuw in.</p>

    <div id="msg-error" class="msg error hidden"></div>
    <div id="msg-ok" class="msg ok hidden"></div>

    <form id="form">
      <label for="pw1">Nieuw wachtwoord</label>
      <input type="password" id="pw1" minlength="8" required />

      <label for="pw2">Herhaal wachtwoord</label>
      <input type="password" id="pw2" minlength="8" required />

      <button type="submit" id="btn">Wachtwoord opslaan</button>
    </form>
  </div>

  <script type="module">
    // Supabase via CDN — geen build-stap nodig
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

    // LET OP: deze URL+anon-key zijn klant-specifiek.
    // Ophalen uit localStorage waar de hoofd-app ze al heeft opgeslagen.
    const tenantRaw = localStorage.getItem('speeq_tenant_config');
    if (!tenantRaw) {
      showError('Geen tenant-configuratie gevonden. Open eerst de hoofdapplicatie via je bedrijfslink.');
      throw new Error('No tenant config');
    }

    let supabaseUrl, supabaseKey;
    try {
      const cfg = JSON.parse(tenantRaw);
      supabaseUrl = cfg.supabaseUrl;
      supabaseKey = cfg.supabaseAnonKey;
    } catch (e) {
      showError('Tenant-configuratie kon niet gelezen worden.');
      throw e;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Recovery-flow: Supabase plaatst tokens in URL hash (#access_token=...)
    // De v2 client pakt dit automatisch op via detectSessionInUrl bij init.
    // Voor zekerheid: setSession indien nodig vanuit hash:
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }

    const form = document.getElementById('form');
    const btn = document.getElementById('btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessages();

      const pw1 = document.getElementById('pw1').value;
      const pw2 = document.getElementById('pw2').value;

      if (pw1.length < 8) return showError('Wachtwoord moet minimaal 8 tekens hebben.');
      if (pw1 !== pw2) return showError('De wachtwoorden zijn niet gelijk.');

      btn.disabled = true;
      btn.textContent = 'Opslaan...';

      const { error } = await supabase.auth.updateUser({ password: pw1 });

      if (error) {
        btn.disabled = false;
        btn.textContent = 'Wachtwoord opslaan';
        return showError(error.message || 'Iets ging mis. Vraag een nieuwe mail aan.');
      }

      showOk('Wachtwoord opgeslagen! Je wordt teruggestuurd naar inloggen...');

      // Slug uit URL voor terugkeer naar juiste tenant
      const params = new URLSearchParams(window.location.search);
      const slug = params.get('t');
      const back = slug ? `/?t=${slug}` : '/';

      setTimeout(() => { window.location.href = back; }, 2000);
    });

    function showError(text) {
      const el = document.getElementById('msg-error');
      el.textContent = text;
      el.classList.remove('hidden');
    }
    function showOk(text) {
      const el = document.getElementById('msg-ok');
      el.textContent = text;
      el.classList.remove('hidden');
    }
    function hideMessages() {
      document.getElementById('msg-error').classList.add('hidden');
      document.getElementById('msg-ok').classList.add('hidden');
    }
  </script>
</body>
</html>
```

### 3. Supabase dashboard — redirect URL whitelisten

Per klant-Supabase project éénmalig instellen:

1. Open klant-Supabase dashboard → **Authentication** → **URL Configuration**
2. Bij **Redirect URLs** toevoegen:
   - `https://speeq-wkb.vercel.app/reset-password.html`
   - `https://speeq-wkb.vercel.app/reset-password.html?t=*`
   - `https://speeq-wkb-tool.vercel.app/reset-password.html` (backup)
3. **E-mail template** voor Recovery (Authentication → Email Templates → Reset Password):
   - Subject: `SpeeQ: stel je nieuwe wachtwoord in`
   - Lichaam: standaard houden of personaliseren, `{{ .ConfirmationURL }}` blijft hetzelfde

**Belangrijk:** dit moet je in **elke** klant-Supabase apart doen. Daarom: in `02-supabase-setup.md` van het handboek toevoegen als stap 6 van de seed-procedure.

## Verificatie — test deze flow eenmaal werkt

1. `npx tsc --noEmit` — geen TypeScript-fouten
2. `npx vercel --prod --yes` — deploy live
3. Ga naar `https://speeq-wkb.vercel.app/?t=<testklant>`
4. Klik "Wachtwoord vergeten?" → vul testaccount in → klik knop
5. Check inbox → klik op recovery-link
6. Vul 2× nieuw wachtwoord → klik opslaan
7. Wordt automatisch teruggestuurd naar `/?t=<testklant>`
8. Log in met nieuw wachtwoord → werkt

## Wat NIET in deze spec zit (bewust)

- Magic link login (alleen wachtwoord-reset, niet passwordless login)
- 2FA / MFA — later
- Account-lockout na X foute pogingen — Supabase doet dit standaard al
- Wachtwoord-sterkte indicator — kan later met `zxcvbn`

## Voor de uitvoerende sessie

Open dit doc en zeg tegen Claude:

> "Implementeer doc 09 — wachtwoord-vergeten. Drie bestanden: LoginScreen.tsx aanpassen, reset-password.html nieuw aanmaken, en de Supabase-instructie noteer ik later zelf. Daarna tsc check en deploy."

Klaar.

---

**Vorige:** [08-volgende-week](08-volgende-week.md) · **Terug naar:** [README](README.md)
