/**
 * Unit-tests voor ShareService — deel een borgingspunt via WhatsApp, e-mail,
 * klembord of de native Web Share API. Geen bibliotheek; alles via deeplinks
 * en browser-API's.
 *
 * We mocken react-native (Platform.OS = 'web') en de relevante browser-API's
 * (window.open, window.location, navigator.clipboard/share), en borgen:
 *   - de gedeelde tekst-opbouw (project, taak, borgingspunt, GPS op 5 decimalen,
 *     optioneel weer/gebruiker) en dat e-mail/klembord/native de markdown-`*`
 *     strippen;
 *   - de wa.me- en mailto-deeplinks met correcte URL-encoding;
 *   - nativeShare geeft true bij succes en false bij een afgewezen share.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import {
  type SharePayload,
  shareViaWhatsApp,
  shareViaEmail,
  copyToClipboard,
  nativeShare,
} from '../ShareService';

const payload = (over: Partial<SharePayload> = {}): SharePayload => ({
  projectId: 'p-1',
  taskTitle: 'Wapening fundering',
  inspectionPointId: 'WAPENING-1',
  timestamp: '2026-01-15T09:30:00Z',
  latitude: 52.070512,
  longitude: 4.300712,
  ...over,
});

let openSpy: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  openSpy = jest.fn();
  (window as any).open = openSpy;
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

describe('shareViaWhatsApp', () => {
  it('opent een wa.me-deeplink met de ge-encode deeltekst', () => {
    shareViaWhatsApp(payload({ weatherLabel: '12°C · Regen', userName: 'Jan' }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toContain('https://wa.me/?text=');
    expect(target).toBe('_blank');
    expect(features).toBe('noopener');
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('Project: p-1');
    expect(text).toContain('Wapening fundering');
    expect(text).toContain('WAPENING-1');
    expect(text).toContain('52.07051, 4.30071'); // GPS op 5 decimalen
    expect(text).toContain('12°C · Regen');
    expect(text).toContain('Jan');
  });

  it('laat optionele weer/gebruiker weg als ze ontbreken', () => {
    shareViaWhatsApp(payload());
    const url = openSpy.mock.calls[0][0] as string;
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).not.toContain('🌤️');
    expect(text).not.toContain('👷');
  });
});

describe('shareViaEmail', () => {
  it('zet een mailto met onderwerp + body en strippt de markdown-sterren', () => {
    shareViaEmail(payload(), 'gemeente@example.nl');
    const href = (window.location as any).href as string;
    expect(href).toContain('mailto:gemeente@example.nl?');
    expect(href).toContain('subject=');
    const body = decodeURIComponent(href.split('body=')[1]);
    expect(body).not.toContain('*');
    expect(body).toContain('Project: p-1');
    const subject = decodeURIComponent(href.split('subject=')[1].split('&')[0]);
    expect(subject).toContain('Wapening fundering');
    expect(subject).toContain('p-1');
  });

  it('laat de ontvanger leeg als geen e-mail is opgegeven', () => {
    shareViaEmail(payload());
    expect((window.location as any).href).toContain('mailto:?');
  });
});

describe('copyToClipboard', () => {
  it('schrijft de gestripte tekst naar het klembord', async () => {
    const writeText = jest.fn((..._a: unknown[]) => Promise.resolve());
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    await copyToClipboard(payload());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).not.toContain('*');
    expect(writeText.mock.calls[0][0]).toContain('WAPENING-1');
  });
});

describe('nativeShare', () => {
  it('geeft true wanneer de Web Share API slaagt', async () => {
    const share = jest.fn((..._a: unknown[]) => Promise.resolve());
    Object.defineProperty(global.navigator, 'share', { value: share, configurable: true });
    await expect(nativeShare(payload())).resolves.toBe(true);
    expect(share).toHaveBeenCalledTimes(1);
    expect((share.mock.calls[0][0] as any).text).not.toContain('*');
  });

  it('geeft false wanneer de gebruiker de share afbreekt', async () => {
    Object.defineProperty(global.navigator, 'share', {
      value: jest.fn(() => Promise.reject(new Error('abort'))),
      configurable: true,
    });
    await expect(nativeShare(payload())).resolves.toBe(false);
  });

  it('geeft false wanneer de Web Share API ontbreekt', async () => {
    Object.defineProperty(global.navigator, 'share', { value: undefined, configurable: true });
    await expect(nativeShare(payload())).resolves.toBe(false);
  });
});
