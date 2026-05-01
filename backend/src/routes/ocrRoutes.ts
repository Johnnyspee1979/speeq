import type { Request, Response } from 'express';

const { Router } = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');
const { scanBetonbonOCR } = require('../services/ocrService');

type UploadedFile = {
  buffer: Buffer;
};

type MulterRequest = Request & {
  file?: UploadedFile;
};

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

let supabaseAdminClient: any | null = null;
let hasWarnedAboutOcrColumns = false;

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

const parseOcrSpec = (rawSpec: unknown) => {
  const normalizeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeSpec = (value: any) => ({
    expectedBetonkwaliteit:
      typeof value?.expectedBetonkwaliteit === 'string'
        ? value.expectedBetonkwaliteit.trim()
        : undefined,
    expectedMilieuklasse:
      typeof value?.expectedMilieuklasse === 'string'
        ? value.expectedMilieuklasse.trim()
        : undefined,
    expectedLeverdatum:
      typeof value?.expectedLeverdatum === 'string'
        ? value.expectedLeverdatum.trim()
        : undefined,
    minVolumeKuub: normalizeNumber(value?.minVolumeKuub),
    maxVolumeKuub: normalizeNumber(value?.maxVolumeKuub),
  });

  if (!rawSpec) {
    return {};
  }

  try {
    if (typeof rawSpec === 'string') {
      const trimmed = rawSpec.trim();
      return trimmed ? normalizeSpec(JSON.parse(trimmed)) : {};
    }

    if (typeof rawSpec === 'object') {
      return normalizeSpec(rawSpec);
    }
  } catch (error) {
    console.warn('OCR spec kon niet worden geparsed, validatie draait zonder projectspecificatie.');
  }

  return {};
};

const safePersistOcrResult = async (
  evidenceId: string,
  ocrResult: {
    ruweTekst: string;
    betonkwaliteit: string | null;
    milieuklasse: string | null;
    volumeKuub: string | null;
    leverdatum: string | null;
  }
) => {
  const supabase = getSupabaseAdminClient();

  try {
    const { error } = await supabase
      .from('evidence')
      .update({
        ocr_text: ocrResult.ruweTekst,
        betonkwaliteit: ocrResult.betonkwaliteit,
        milieuklasse: ocrResult.milieuklasse,
        volume: ocrResult.volumeKuub,
        leverdatum: ocrResult.leverdatum,
      })
      .eq('id', evidenceId);

    if (!error) {
      return;
    }

    const message = String(error.message ?? '').toLowerCase();
    if (
      message.includes('ocr_text') ||
      message.includes('betonkwaliteit') ||
      message.includes('milieuklasse') ||
      message.includes('volume') ||
      message.includes('leverdatum')
    ) {
      if (!hasWarnedAboutOcrColumns) {
        console.warn(
          'OCR metadata wordt niet opgeslagen: voeg ocr_text, betonkwaliteit, milieuklasse, volume en leverdatum toe aan de Supabase tabel "evidence".'
        );
        hasWarnedAboutOcrColumns = true;
      }
      return;
    }

    throw new Error(error.message);
  } catch (error: any) {
    if (!hasWarnedAboutOcrColumns) {
      console.warn(
        `Kon OCR metadata niet opslaan voor bewijs ${evidenceId}: ${
          error?.message ?? 'onbekende fout'
        }`
      );
      hasWarnedAboutOcrColumns = true;
    }
  }
};

router.post(
  '/scan-betonbon',
  upload.single('bonFoto'),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      const evidenceId = String(req.body?.evidenceId ?? '').trim();

      if (!req.file || !evidenceId) {
        res.status(400).json({
          error: 'Foto of evidenceId ontbreekt in het request.',
        });
        return;
      }

      const spec = parseOcrSpec(req.body?.spec);
      const geextraheerdeData = await scanBetonbonOCR(req.file.buffer, spec);
      await safePersistOcrResult(evidenceId, geextraheerdeData);

      console.log(`✅ Betonbon OCR succesvol verwerkt voor bewijsstuk: ${evidenceId}`);
      res.status(200).json({
        success: true,
        message: 'Betonbon succesvol gescand en aan dossier toegevoegd.',
        data: geextraheerdeData,
      });
    } catch (error: any) {
      console.error('❌ Route fout:', error?.message ?? error);
      res.status(500).json({
        error: 'Interne serverfout bij het scannen van de betonbon.',
      });
    }
  }
);

module.exports = router;
