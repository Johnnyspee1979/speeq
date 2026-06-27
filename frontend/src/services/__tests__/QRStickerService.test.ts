/**
 * Unit-tests voor QRStickerService — de print-klare QR-sticker-vellen per
 * borgingspunt. We borgen de deterministische bouwstenen (deep-link URL,
 * QR-afbeeldings-URL en de HTML-string), met nadruk op correcte URL-encoding
 * van project- en taak-id's (een naam met spaties/& mag de querystring niet
 * breken) en dat elk borgingspunt precies één sticker oplevert.
 */

jest.mock('../TenantBrandingService', () => ({
  getBrandingSync: () => ({ companyName: 'Spee Solutions' }),
}));

import {
  type StickerTask,
  buildTaskUrl,
  buildQRImageUrl,
  generateQRStickerHtml,
} from '../QRStickerService';

const task = (over: Partial<StickerTask> = {}): StickerTask => ({
  inspectionPointId: 'WAPENING-1',
  label: 'Wapening fundering',
  categoryIcon: '🔩',
  discipline: 'Constructie',
  ...over,
});

describe('buildTaskUrl', () => {
  it('bouwt een deep-link met project- en taak-querystring', () => {
    expect(buildTaskUrl('https://app.x', 'p-1', 'WAPENING-1')).toBe(
      'https://app.x/?project=p-1&task=WAPENING-1'
    );
  });

  it('encodeert speciale tekens in project en taak', () => {
    const url = buildTaskUrl('https://app.x', 'Spee & Co', 'punt/2');
    expect(url).toContain('project=Spee%20%26%20Co');
    expect(url).toContain('task=punt%2F2');
  });
});

describe('buildQRImageUrl', () => {
  it('gebruikt api.qrserver.com met default-grootte en ge-encode data', () => {
    const img = buildQRImageUrl('https://app.x/?project=p-1');
    expect(img).toContain('https://api.qrserver.com/v1/create-qr-code/');
    expect(img).toContain('size=140x140');
    expect(img).toContain('data=https%3A%2F%2Fapp.x%2F%3Fproject%3Dp-1');
  });

  it('respecteert een aangepaste grootte', () => {
    expect(buildQRImageUrl('x', 130)).toContain('size=130x130');
  });
});

describe('generateQRStickerHtml', () => {
  it('bouwt één sticker per borgingspunt en zet de juiste id/labels', () => {
    const html = generateQRStickerHtml(
      {
        projectId: 'p-1',
        projectName: 'Woning Spee',
        tasks: [task(), task({ inspectionPointId: 'GEVEL-2', label: 'Gevelisolatie' })],
      },
      'https://app.x'
    );

    expect((html.match(/class="sticker"/g) || []).length).toBe(2);
    expect(html).toContain('WAPENING-1');
    expect(html).toContain('GEVEL-2');
    expect(html).toContain('Gevelisolatie');
    expect(html).toContain('2 borgingspunten');
  });

  it('zet de QR-afbeelding met de deep-link van het borgingspunt', () => {
    const html = generateQRStickerHtml(
      { projectId: 'p-1', projectName: 'X', tasks: [task()] },
      'https://app.x'
    );
    const expectedQr = buildQRImageUrl(buildTaskUrl('https://app.x', 'p-1', 'WAPENING-1'), 130);
    expect(html).toContain(expectedQr);
  });

  it('toont de bedrijfsnaam uit de branding in de footer', () => {
    const html = generateQRStickerHtml(
      { projectId: 'p-1', projectName: 'X', tasks: [] },
      'https://app.x'
    );
    expect(html).toContain('Spee Solutions');
    expect(html).toContain('0 borgingspunten');
  });
});
