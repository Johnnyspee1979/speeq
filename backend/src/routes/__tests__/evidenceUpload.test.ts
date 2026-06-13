/**
 * Integratietest voor de upload-hardening op /api/wkb-evidence/upload.
 *
 * Borgt de invoer-randen die multer nu afvangt VOORDAT de handler (en dus AI
 * + Supabase) draait:
 *   - niet-afbeelding → 415 met nette NL-melding
 *   - te groot bestand (>15 MB) → 413 met nette NL-melding
 *
 * We mounten de echte router op een wegwerp-Express-app en praten via Node's
 * ingebouwde fetch/FormData/Blob — geen supertest of andere nieuwe dependency.
 */

const express = require('express');
const evidenceRoutes = require('../evidenceRoutes');

let server: any;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use('/api/wkb-evidence', evidenceRoutes);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('POST /api/wkb-evidence/upload — invoer-hardening', () => {
  it('weigert een niet-afbeelding met 415', async () => {
    const form = new FormData();
    form.append('photo', new Blob(['niet een foto'], { type: 'text/plain' }), 'nep.txt');
    form.append('evidenceData', JSON.stringify({ evidenceId: 'e1' }));

    const res = await fetch(`${baseUrl}/api/wkb-evidence/upload`, {
      method: 'POST',
      body: form as any,
    });

    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error).toMatch(/afbeeldingen/i);
  });

  it('weigert een te grote afbeelding met 413', async () => {
    const tooBig = new Uint8Array(16 * 1024 * 1024); // 16 MB > 15 MB limiet
    const form = new FormData();
    form.append('photo', new Blob([tooBig], { type: 'image/jpeg' }), 'groot.jpg');
    form.append('evidenceData', JSON.stringify({ evidenceId: 'e2' }));

    const res = await fetch(`${baseUrl}/api/wkb-evidence/upload`, {
      method: 'POST',
      body: form as any,
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/te groot/i);
  });
});
