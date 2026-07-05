/**
 * @jest-environment jsdom
 *
 * Gedrag-tests voor de web-only font-injectie (theme/injectGoogleFonts.ts). Deze
 * module injecteert bij import <link>-tags naar Google Fonts in document.head,
 * idempotent via een id-check. Op web hangt de typografie hiervan af; een
 * dubbele injectie (bij meerdere imports) of een ontbrekende family laat fonts
 * flikkeren of terugvallen op system-fonts. We borgen het feitelijke DOM-gedrag:
 *  - bij import komt er een stylesheet-link met id 'speeq-google-fonts';
 *  - er staan twee preconnect-links (googleapis + gstatic);
 *  - de stylesheet-href bevat alle vijf de verwachte font-families + display=swap;
 *  - herhaalde import voegt NIETS dubbel toe (idempotent).
 *
 * De native no-op-tak (typeof document === 'undefined') is in jsdom niet schoon
 * te simuleren en wordt hier bewust niet getest.
 *
 * Web-DOM side-effect → @jest-environment jsdom; verse imports via isolateModules.
 */

const STYLESHEET_ID = 'speeq-google-fonts';

const importModule = (): void => {
  jest.isolateModules(() => {
    require('../injectGoogleFonts');
  });
};

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('injectGoogleFonts', () => {
  it('injecteert een stylesheet-link met het verwachte id', () => {
    importModule();
    const link = document.getElementById(STYLESHEET_ID);
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe('LINK');
    expect(link?.getAttribute('rel')).toBe('stylesheet');
  });

  it('voegt preconnect-links toe voor googleapis en gstatic', () => {
    importModule();
    const hrefs = Array.from(
      document.head.querySelectorAll('link[rel="preconnect"]'),
    ).map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
      ]),
    );
  });

  it('laadt alle verwachte font-families met display=swap', () => {
    importModule();
    const href = document.getElementById(STYLESHEET_ID)?.getAttribute('href') ?? '';
    for (const family of [
      'Playfair+Display',
      'Inter',
      'Bricolage+Grotesque',
      'Plus+Jakarta+Sans',
      'JetBrains+Mono',
    ]) {
      expect(href).toContain(family);
    }
    expect(href).toContain('display=swap');
  });

  it('is idempotent: herhaalde import dupliceert niets', () => {
    importModule();
    importModule();
    expect(document.querySelectorAll(`#${STYLESHEET_ID}`).length).toBe(1);
    expect(document.head.querySelectorAll('link[rel="preconnect"]').length).toBe(2);
  });
});
