import type { Request, Response } from 'express';

const { Router } = require('express');
const { createClient } = require('@supabase/supabase-js');
const { differenceInCalendarDays, parseISO, isValid, startOfDay } = require('date-fns');
const { backendConfig, hasSupabaseConfig } = require('../config');
const {
  submitBouwmeldingToDSO,
  submitGereedmeldingToDSO,
} = require('../services/dsoService');

type ProjectRow = Record<string, unknown>;

type ProjectLookupResult = {
  tableName: 'projects' | 'Projects';
  row: ProjectRow;
};

type NormalizedProjectData = {
  projectId: string;
  initiatorDetails: {
    name: string;
    address: string;
    email: string;
  };
  location: {
    kadastraleAanduiding: string;
    coordinates: { lat: number; lng: number };
  };
  kwaliteitsborgerId: string;
  instrumentId: string;
  borgingsplanUrl: string;
  risicoUrl: string;
  dossierBevoegdGezagUrl: string;
  verklaringKwaliteitsborgerUrl: string;
};

const router = Router();

let supabaseAdminClient: any | null = null;
let hasWarnedAboutBouwmeldingStatusColumns = false;
let hasWarnedAboutGereedmeldingStatusColumns = false;

const projectSelect = '*';

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt');
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }

  return supabaseAdminClient;
};

const getString = (row: ProjectRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getNumber = (row: ProjectRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return Number.NaN;
};

const fetchProjectRecord = async (projectId: string): Promise<ProjectLookupResult | null> => {
  const supabase = getSupabaseAdminClient();

  const tableNames: Array<'projects' | 'Projects'> = ['projects', 'Projects'];

  for (const tableName of tableNames) {
    const { data, error } = await supabase
      .from(tableName)
      .select(projectSelect)
      .eq('id', projectId)
      .maybeSingle();

    if (!error && data) {
      return {
        tableName,
        row: data as ProjectRow,
      };
    }

    if (
      error &&
      !String(error.message ?? '').toLowerCase().includes('does not exist') &&
      !String(error.message ?? '').toLowerCase().includes('schema cache')
    ) {
      throw new Error(error.message);
    }
  }

  return null;
};

const normalizeProjectRow = (
  projectId: string,
  row: ProjectRow
): { projectData?: NormalizedProjectData; missingFields: string[] } => {
  const name = getString(row, ['initiator_name', 'name', 'naam', 'initiator_naam']);
  const address = getString(row, ['address', 'adres', 'initiator_address']);
  const email = getString(row, ['email', 'initiator_email']);
  const kadastraleAanduiding = getString(row, [
    'kadastrale_aanduiding',
    'kadastraleAanduiding',
  ]);
  const kwaliteitsborgerId = getString(row, [
    'kwaliteitsborger_id',
    'kwaliteitsborgerId',
  ]);
  const instrumentId = getString(row, ['instrument_id', 'instrumentId']);
  const borgingsplanUrl = getString(row, ['borgingsplan_url', 'borgingsplanUrl']);
  const risicoUrl = getString(row, [
    'risicobeoordeling_url',
    'risicobeoordelingUrl',
    'risico_url',
  ]);
  const dossierBevoegdGezagUrl = getString(row, [
    'dossier_bevoegd_gezag_url',
    'dossierBevoegdGezagUrl',
  ]);
  const verklaringKwaliteitsborgerUrl = getString(row, [
    'verklaring_kwaliteitsborger_url',
    'verklaringKwaliteitsborgerUrl',
  ]);
  const lat = getNumber(row, ['latitude', 'lat']);
  const lng = getNumber(row, ['longitude', 'lng', 'long']);

  const missingFields: string[] = [];

  if (!name) missingFields.push('initiatorDetails.name');
  if (!address) missingFields.push('initiatorDetails.address');
  if (!email) missingFields.push('initiatorDetails.email');
  if (!kadastraleAanduiding) missingFields.push('location.kadastraleAanduiding');
  if (!Number.isFinite(lat)) missingFields.push('location.coordinates.lat');
  if (!Number.isFinite(lng)) missingFields.push('location.coordinates.lng');
  if (!kwaliteitsborgerId) missingFields.push('kwaliteitsborgerId');
  if (!instrumentId) missingFields.push('instrumentId');
  if (missingFields.length > 0) {
    return { missingFields };
  }

  return {
    missingFields,
    projectData: {
      projectId,
      initiatorDetails: {
        name,
        address,
        email,
      },
      location: {
        kadastraleAanduiding,
        coordinates: { lat, lng },
      },
      kwaliteitsborgerId,
      instrumentId,
      borgingsplanUrl,
      risicoUrl,
      dossierBevoegdGezagUrl,
      verklaringKwaliteitsborgerUrl,
    },
  };
};

const safeUpdateProjectBouwmeldingStatus = async (
  tableName: 'projects' | 'Projects',
  projectId: string,
  transactionId: string | null
) => {
  const supabase = getSupabaseAdminClient();

  try {
    const { error } = await supabase
      .from(tableName)
      .update({
        dso_bouwmelding_status: 'INGEDIEND',
        dso_meldings_datum: new Date().toISOString(),
        dso_transaction_id: transactionId,
      })
      .eq('id', projectId);

    if (!error) {
      return;
    }

    const message = String(error.message ?? '').toLowerCase();
    if (
      message.includes('dso_bouwmelding_status') ||
      message.includes('dso_meldings_datum') ||
      message.includes('dso_transaction_id')
    ) {
      if (!hasWarnedAboutBouwmeldingStatusColumns) {
        console.warn(
          'Projectstatus na DSO-submit wordt niet opgeslagen: voeg dso_bouwmelding_status, dso_meldings_datum en dso_transaction_id toe aan de projecttabel.'
        );
        hasWarnedAboutBouwmeldingStatusColumns = true;
      }
      return;
    }

    console.warn(
      `Kon DSO projectstatus niet updaten voor project ${projectId}: ${error.message}`
    );
  } catch (error: any) {
    console.warn(
      `Kon DSO projectstatus niet updaten voor project ${projectId}: ${
        error?.message ?? 'onbekende fout'
      }`
    );
  }
};

const safeUpdateProjectGereedmeldingStatus = async (
  tableName: 'projects' | 'Projects',
  projectId: string,
  transactionId: string | null
) => {
  const supabase = getSupabaseAdminClient();

  try {
    const { error } = await supabase
      .from(tableName)
      .update({
        dso_gereedmelding_status: 'INGEDIEND',
        dso_gereedmeldings_datum: new Date().toISOString(),
        dso_gereedmelding_transaction_id: transactionId,
      })
      .eq('id', projectId);

    if (!error) {
      return;
    }

    const message = String(error.message ?? '').toLowerCase();
    if (
      message.includes('dso_gereedmelding_status') ||
      message.includes('dso_gereedmeldings_datum') ||
      message.includes('dso_gereedmelding_transaction_id')
    ) {
      if (!hasWarnedAboutGereedmeldingStatusColumns) {
        console.warn(
          'Projectstatus na DSO gereedmelding wordt niet opgeslagen: voeg dso_gereedmelding_status, dso_gereedmeldings_datum en dso_gereedmelding_transaction_id toe aan de projecttabel.'
        );
        hasWarnedAboutGereedmeldingStatusColumns = true;
      }
      return;
    }

    console.warn(
      `Kon DSO gereedmeldingstatus niet updaten voor project ${projectId}: ${error.message}`
    );
  } catch (error: any) {
    console.warn(
      `Kon DSO gereedmeldingstatus niet updaten voor project ${projectId}: ${
        error?.message ?? 'onbekende fout'
      }`
    );
  }
};

router.post('/bouwmelding/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId ?? '').trim();
    const verwachteStartDatum = String(req.body?.verwachteStartDatum ?? '').trim();

    if (!projectId) {
      res.status(400).json({ error: 'projectId is verplicht.' });
      return;
    }

    if (!verwachteStartDatum) {
      res.status(400).json({
        error: 'Verwachte startdatum is verplicht voor de bouwmelding.',
      });
      return;
    }

    const parsedStartDate = parseISO(verwachteStartDatum);
    if (!isValid(parsedStartDate)) {
      res.status(400).json({
        error: 'Verwachte startdatum is ongeldig. Gebruik ISO-formaat, bijvoorbeeld 2026-04-15.',
      });
      return;
    }

    const dagenTotStart = differenceInCalendarDays(
      startOfDay(parsedStartDate),
      startOfDay(new Date())
    );

    if (dagenTotStart < 28) {
      res.status(400).json({
        error: `Wkb-overtreding: een bouwmelding moet uiterlijk 4 weken voor de start worden ingediend. Geplande start is over ${dagenTotStart} dagen.`,
      });
      return;
    }

    const projectLookup = await fetchProjectRecord(projectId);

    if (!projectLookup) {
      res.status(404).json({ error: 'Project niet gevonden in de database.' });
      return;
    }

    const normalized = normalizeProjectRow(projectId, projectLookup.row);

    if (!normalized.projectData) {
      res.status(400).json({
        error:
          'Project mist verplichte STAM-gegevens voor de bouwmelding.',
        missingFields: normalized.missingFields,
      });
      return;
    }

    const missingFields = [...normalized.missingFields];
    if (!normalized.projectData.borgingsplanUrl) {
      missingFields.push('borgingsplanUrl');
    }
    if (!normalized.projectData.risicoUrl) {
      missingFields.push('risicoUrl');
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Project mist verplichte STAM-gegevens voor de bouwmelding.',
        missingFields,
      });
      return;
    }

    console.log(`🏛️ Start geautomatiseerde STAM-bouwmelding voor project ${projectId}...`);

    const result = await submitBouwmeldingToDSO(
      {
        projectId: normalized.projectData.projectId,
        initiatorDetails: normalized.projectData.initiatorDetails,
        location: normalized.projectData.location,
        kwaliteitsborgerId: normalized.projectData.kwaliteitsborgerId,
        instrumentId: normalized.projectData.instrumentId,
      },
      normalized.projectData.borgingsplanUrl,
      normalized.projectData.risicoUrl
    );

    if (!result.success) {
      res.status(502).json({
        error:
          'Digikoppeling-adapter accepteerde de bouwmelding niet.',
        transactionId: result.transactionId ?? null,
        status: result.status,
      });
      return;
    }

    await safeUpdateProjectBouwmeldingStatus(
      projectLookup.tableName,
      projectId,
      result.transactionId ?? null
    );

    res.status(202).json({
      success: true,
      message:
        'Bouwmelding succesvol via Digikoppeling ingediend bij het bevoegd gezag. De 4-weken termijn is gestart.',
      transactionId: result.transactionId ?? null,
      daysUntilStart: dagenTotStart,
      submittedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Fout bij automatiseren bouwmelding:', error?.message ?? error);
    res.status(500).json({
      error: error?.message ?? 'Interne serverfout bij communicatie met het DSO.',
    });
  }
});

router.post('/gereedmelding/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = String(req.params.projectId ?? '').trim();
    const ingebruiknameDatum = String(req.body?.ingebruiknameDatum ?? '').trim();

    if (!projectId) {
      res.status(400).json({ error: 'projectId is verplicht.' });
      return;
    }

    if (!ingebruiknameDatum) {
      res.status(400).json({
        error: 'Geplande ingebruiknamedatum is verplicht.',
      });
      return;
    }

    const parsedIngebruiknameDatum = parseISO(ingebruiknameDatum);
    if (!isValid(parsedIngebruiknameDatum)) {
      res.status(400).json({
        error:
          'Geplande ingebruiknamedatum is ongeldig. Gebruik ISO-formaat, bijvoorbeeld 2026-04-15.',
      });
      return;
    }

    const dagenTotIngebruikname = differenceInCalendarDays(
      startOfDay(parsedIngebruiknameDatum),
      startOfDay(new Date())
    );

    if (dagenTotIngebruikname < 14) {
      res.status(400).json({
        error: `Wkb-overtreding: een gereedmelding moet uiterlijk 2 weken voor ingebruikname worden ingediend. Geplande datum is over ${dagenTotIngebruikname} dagen.`,
      });
      return;
    }

    const projectLookup = await fetchProjectRecord(projectId);

    if (!projectLookup) {
      res.status(404).json({ error: 'Project niet gevonden in de database.' });
      return;
    }

    const normalized = normalizeProjectRow(projectId, projectLookup.row);

    if (!normalized.projectData) {
      res.status(400).json({
        error: 'Project mist verplichte STAM-gegevens voor de gereedmelding.',
        missingFields: normalized.missingFields,
      });
      return;
    }

    const missingFields = [...normalized.missingFields];
    if (!normalized.projectData.dossierBevoegdGezagUrl) {
      missingFields.push('dossierBevoegdGezagUrl');
    }
    if (!normalized.projectData.verklaringKwaliteitsborgerUrl) {
      missingFields.push('verklaringKwaliteitsborgerUrl');
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Project mist verplichte STAM-gegevens voor de gereedmelding.',
        missingFields,
      });
      return;
    }

    console.log(`🏁 Start geautomatiseerde STAM-gereedmelding voor project ${projectId}...`);

    const result = await submitGereedmeldingToDSO(
      {
        projectId: normalized.projectData.projectId,
        initiatorDetails: normalized.projectData.initiatorDetails,
        location: normalized.projectData.location,
        kwaliteitsborgerId: normalized.projectData.kwaliteitsborgerId,
        instrumentId: normalized.projectData.instrumentId,
        ingebruiknameDatum,
      },
      normalized.projectData.dossierBevoegdGezagUrl,
      normalized.projectData.verklaringKwaliteitsborgerUrl
    );

    if (!result.success) {
      res.status(502).json({
        error:
          'Digikoppeling-adapter accepteerde de gereedmelding niet.',
        transactionId: result.transactionId ?? null,
        status: result.status,
      });
      return;
    }

    await safeUpdateProjectGereedmeldingStatus(
      projectLookup.tableName,
      projectId,
      result.transactionId ?? null
    );

    res.status(202).json({
      success: true,
      message:
        'Gereedmelding succesvol via Digikoppeling ingediend. De 2-weken termijn richting ingebruikname loopt nu.',
      transactionId: result.transactionId ?? null,
      daysUntilOccupancy: dagenTotIngebruikname,
      submittedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Fout bij automatiseren gereedmelding:', error?.message ?? error);
    res.status(500).json({
      error: error?.message ?? 'Interne serverfout bij communicatie met het DSO.',
    });
  }
});

module.exports = router;
