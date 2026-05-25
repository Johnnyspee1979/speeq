// frontend/src/theme/injectGoogleFonts.ts
//
// Web-only module: injecteert <link>-tags naar Google Fonts (Playfair Display
// + Inter) in document.head bij eerste import. Nodig omdat Expo's web export
// onze eigen frontend/web/index.html negeert — die wordt vervangen door
// Expo's default template tijdens de build. Een JS-side effect omzeilt dat.
//
// Idempotent via een id-check: meerdere imports voegen niet meerdere tags toe.

const STYLESHEET_ID = 'speeq-google-fonts';

if (typeof document !== 'undefined' && !document.getElementById(STYLESHEET_ID)) {
  // Preconnect voor snellere first paint
  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnect1);

  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = '';
  document.head.appendChild(preconnect2);

  // Light/Dark (Warm Minimal): Playfair Display + Inter
  // Modern (Claude Design): Bricolage Grotesque + Plus Jakarta Sans + JetBrains Mono
  // Eén stylesheet laadt allebei zodat theme-toggle direct werkt zonder herlaad.
  const stylesheet = document.createElement('link');
  stylesheet.id = STYLESHEET_ID;
  stylesheet.rel = 'stylesheet';
  stylesheet.href =
    'https://fonts.googleapis.com/css2' +
    '?family=Playfair+Display:ital,wght@0,400..900;1,400..900' +
    '&family=Inter:wght@400;500;600;700' +
    '&family=Bricolage+Grotesque:opsz,wght@12..96,400..800' +
    '&family=Plus+Jakarta+Sans:wght@400;500;600;700;800' +
    '&family=JetBrains+Mono:wght@400;500' +
    '&display=swap';
  document.head.appendChild(stylesheet);
}

export {};
