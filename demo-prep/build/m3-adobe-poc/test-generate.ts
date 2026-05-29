/**
 * Test script: genereer een dossier-PDF voor het sales-demo project.
 *
 * Gebruik:
 *   ts-node test-generate.ts                 # auto-renderer (Adobe als credentials, anders local)
 *   ts-node test-generate.ts local           # forceer local renderer
 *   ts-node test-generate.ts adobe           # forceer Adobe (faalt zonder credentials)
 *
 * Vereiste env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   PDF_SERVICES_CLIENT_ID    (optioneel — alleen voor Adobe pad)
 *   PDF_SERVICES_CLIENT_SECRET (optioneel)
 */

import { generateDossierPdf, RendererType } from './dossierPdfService';
import { createClient } from '@supabase/supabase-js';

const SALES_DEMO_PROJECT = 'sales-demo-2026-05-29';

async function main() {
  const renderer = (process.argv[2] ?? 'auto') as RendererType;
  console.log(`Test-runner — renderer=${renderer}`);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  // Vind of maak een dossier voor sales-demo project
  let { data: dossier } = await supabase
    .from('dossiers')
    .select('id')
    .eq('project_id', SALES_DEMO_PROJECT)
    .maybeSingle();

  if (!dossier) {
    console.log('Geen dossier gevonden voor sales-demo project, maak een aan...');
    const { data: newDossier, error } = await supabase
      .from('dossiers')
      .insert({
        project_id: SALES_DEMO_PROJECT,
        tenant_id: 'demo',
        status: 'concept',
      })
      .select('id')
      .single();
    if (error) {
      console.error('Kon dossier niet aanmaken:', error.message);
      process.exit(1);
    }
    dossier = newDossier;
  }

  const dossierId = dossier!.id;
  console.log(`Dossier-id: ${dossierId}`);

  try {
    const pdfUrl = await generateDossierPdf(dossierId, {
      renderer,
      dryRun: true,            // schrijf naar /tmp voor test
      outputDir: '/tmp',
    });
    console.log(`\nKLAAR! PDF: ${pdfUrl}`);
    console.log(`Open: open ${pdfUrl.replace('file://', '')}`);
  } catch (e: any) {
    console.error('FOUT:', e.message);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
