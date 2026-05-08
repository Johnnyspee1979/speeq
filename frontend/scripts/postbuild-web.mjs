#!/usr/bin/env node
/**
 * Sprint 9 — Inject UI UX Pro Max design-tokens in de Expo-generated dist/index.html.
 *
 * Expo `export --platform web` genereert een minimale HTML zonder onze custom
 * <head>-content. Deze post-build stap injecteert:
 *   - Google Fonts (Fira Sans + Fira Code)
 *   - PWA meta-tags (theme-color, apple-mobile-web-app-*)
 *   - Manifest + apple-touch-icon
 *   - Globale CSS (focus-visible, prefers-reduced-motion, cursor pointer)
 *   - Service Worker registratie
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distHtml = resolve(here, '..', 'dist', 'index.html');

if (!existsSync(distHtml)) {
  console.error('[postbuild-web] dist/index.html niet gevonden — sla over.');
  process.exit(0);
}

let html = readFileSync(distHtml, 'utf8');

const headInjections = `
    <meta name="theme-color" content="#A40D2F" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="SpeeQ WKB" />
    <link rel="apple-touch-icon" href="/assets/icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />

    <!-- Sprint 9 — UI UX Pro Max typography -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700;900&display=swap" />

    <style id="sprint9-foundation">
      html, body, #root, button, input, textarea, select {
        font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
      }
      html, body { background-color: #020617; color: #F8FAFC; }
      :focus-visible { outline: 2px solid #A40D2F; outline-offset: 2px; border-radius: 6px; }
      *:focus:not(:focus-visible) { outline: none; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }
      button, a, [role="button"], [data-pressable="true"] { cursor: pointer; }
      button:disabled, [aria-disabled="true"] { cursor: not-allowed; }
      * { -webkit-tap-highlight-color: rgba(164, 13, 47, 0.2); touch-action: manipulation; }
      @media (min-width: 768px) {
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      }
    </style>
`;

const swSnippet = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(function(reg) { console.log('[SW] geregistreerd:', reg.scope); })
            .catch(function(err) { console.warn('[SW] registratie mislukt:', err); });
        });
      }
    </script>
`;

if (!html.includes('sprint9-foundation')) {
  html = html.replace('</head>', `${headInjections}\n  </head>`);
}
if (!html.includes("serviceWorker.register('/sw.js'")) {
  html = html.replace('</body>', `${swSnippet}\n  </body>`);
}
// Lang attribuut van en → nl
html = html.replace('<html lang="en">', '<html lang="nl">');

writeFileSync(distHtml, html, 'utf8');
console.log('[postbuild-web] Sprint 9 design-tokens geïnjecteerd in dist/index.html');
