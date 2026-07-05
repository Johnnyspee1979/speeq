// DemoDataService — vult een leeg project met realistische demo-bewijzen voor
// verkoopgesprekken, en ruimt ze daarna weer op. Schrijft naar de cloud-
// `evidence`-tabel via de ingelogde Supabase-sessie (dus onder RLS).
//
// RLS-EISEN op de evidence-tabel (geverifieerd op het schema):
//   • INSERT slaagt als  auth.uid() = user_id   OF   tenant_id ∈ jouw orgs.
//   • DELETE kan ALLEEN via de tenant-isolatie-policy (tenant_id ∈ jouw orgs);
//     er is geen self-delete-policy.
// Daarom zetten we ALTIJD zowel user_id (sessie-uid) als tenant_id (actieve
// tenant). Zo slaagt zowel de injectie als het opruimen, en zien we de rijen
// terug (self_select + tenant-isolatie). De actieve tenant komt uit
// profiles.tenant_id — exact de bron van get_user_enrolled_organization_ids().
//
// De demo-rijen zijn gemarkeerd met exif_hash 'DEMO_MARKER_n' zodat
// clearDemoData ze gericht kan wissen zonder echte bewijzen te raken.
//
// Foto's zijn externe Unsplash-URL's. storageUrl.ts laat http(s)-URL's
// ongemoeid (passthrough), dus er is geen storage-upload nodig.

import { supabase } from '../lib/supabase';

const DEMO_MARKER_PREFIX = 'DEMO_MARKER';

interface DemoPhoto {
  marker: string;
  photo: string;
  aiStatus: 'PASSED' | 'NEEDS_REVIEW' | 'FAILED';
  fieldNote: string;
  aiNotes: string;
}

// Vier realistische WKB-momenten: fundering, spouw, dak, wapening.
const DEMO_PHOTOS: DemoPhoto[] = [
  {
    marker: 'DEMO_MARKER_1',
    photo: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    aiStatus: 'PASSED',
    fieldNote: 'Fundering noordzijde — wapening gereed voor stort.',
    aiNotes: 'AI-analyse: wapening gedetecteerd, dekking conform Bbl. Geen afwijkingen.',
  },
  {
    marker: 'DEMO_MARKER_2',
    photo: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
    aiStatus: 'PASSED',
    fieldNote: 'Spouwmuur begane grond — isolatie aangebracht en spouwankers geplaatst.',
    aiNotes: 'AI-analyse: spouwisolatie aanwezig, ankerafstand binnen norm. Akkoord.',
  },
  {
    marker: 'DEMO_MARKER_3',
    photo: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80',
    aiStatus: 'NEEDS_REVIEW',
    fieldNote: 'Dakconstructie — gordingen geplaatst, onderdak deels aangebracht.',
    aiNotes: 'AI-analyse: detail nok onduidelijk op foto. Handmatige controle gewenst.',
  },
  {
    marker: 'DEMO_MARKER_4',
    photo: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80',
    aiStatus: 'FAILED',
    fieldNote: 'Wapening vloer verdieping — staafafstand op zuidhoek te ruim.',
    aiNotes: 'AI-analyse: hart-op-hart-afstand wijkt af van bestek. Herstel vereist vóór stort.',
  },
];

/**
 * Vult `projectId` met 4 demo-bewijzen onder `tenantId`. Returnt true bij
 * succes. Vereist een actieve Supabase-sessie (voor user_id + RLS).
 */
export async function populateDemoData(projectId: string, tenantId: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;
    if (!userId) {
      console.warn('[DemoDataService] geen sessie — kan geen demo-data inserten (RLS).');
      return false;
    }

    const now = Date.now();
    const rows = DEMO_PHOTOS.map((p, i) => ({
      project_id: projectId,
      tenant_id: tenantId,
      user_id: userId,
      photo_uri: p.photo,
      media_uri: p.photo,
      latitude: 52.3702 + i * 0.0003,
      longitude: 4.8951 + i * 0.0002,
      exif_hash: p.marker,
      field_note: p.fieldNote,
      ai_notes: p.aiNotes,
      ai_status: p.aiStatus,
      review_status: 'PENDING_REVIEW',
      // Stapsgewijs een paar uur terug, zodat de tijdlijn natuurlijk oogt.
      timestamp: new Date(now - (i + 1) * 2 * 60 * 60 * 1000).toISOString(),
    }));

    const { error } = await supabase.from('evidence').insert(rows);
    if (error) {
      console.error('[DemoDataService] populate fout:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[DemoDataService] populate exception:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Wist alle demo-rijen (exif_hash begint met 'DEMO_MARKER') voor dit project.
 * RLS scoped het verwijderen automatisch tot jouw tenant.
 */
export async function clearDemoData(projectId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('evidence')
      .delete()
      .eq('project_id', projectId)
      .like('exif_hash', `${DEMO_MARKER_PREFIX}%`);
    if (error) {
      console.error('[DemoDataService] clear fout:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[DemoDataService] clear exception:', err instanceof Error ? err.message : err);
    return false;
  }
}
