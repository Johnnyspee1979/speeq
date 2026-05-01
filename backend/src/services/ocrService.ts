const Tesseract = require('tesseract.js');

type BetonbonSpec = {
  expectedBetonkwaliteit?: string | null;
  expectedMilieuklasse?: string | null;
  minVolumeKuub?: number | null;
  maxVolumeKuub?: number | null;
  expectedLeverdatum?: string | null;
};

type BetonbonValidationResult = {
  passed: boolean;
  matchedSpec: boolean;
  missingFields: string[];
  warnings: string[];
};

type BetonbonData = {
  betonkwaliteit: string | null;
  milieuklasse: string | null;
  volumeKuub: string | null;
  leverdatum: string | null;
  ruweTekst: string;
  validation: BetonbonValidationResult;
};

const normalizeWhitespace = (value: string) =>
  value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();

const normalizeDecimal = (value: string) => value.replace(',', '.');

const normalizeUpper = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const normalizeDateToken = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .replace(/\//g, '-');

const extractBetonkwaliteit = (text: string) =>
  text.match(/\bC\d{2}\/\d{2}\b/i)?.[0]?.toUpperCase() ?? null;

const extractMilieuklasse = (text: string) =>
  text.match(/\b(?:XC|XD|XS|XF|XA|XM)\d\b/i)?.[0]?.toUpperCase() ?? null;

const extractVolume = (text: string) => {
  const explicitVolumeMatch = text.match(
    /\b(?:volume|inhoud|geleverd)\s*[:=]?\s*(\d+[.,]?\d*)\s*(m3|m³|kuub)\b/i
  );
  const genericVolumeMatch =
    explicitVolumeMatch ?? text.match(/\b(\d+[.,]?\d*)\s*(m3|m³|kuub)\b/i);

  return genericVolumeMatch?.[1]
    ? normalizeDecimal(genericVolumeMatch[1])
    : null;
};

const extractLeverdatum = (text: string) =>
  text.match(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/)?.[0] ??
  text.match(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/)?.[0] ??
  null;

const validateBetonbonData = (
  result: Omit<BetonbonData, 'validation'>,
  spec: BetonbonSpec = {}
): BetonbonValidationResult => {
  const missingFields = [
    result.betonkwaliteit ? null : 'betonkwaliteit',
    result.milieuklasse ? null : 'milieuklasse',
    result.volumeKuub ? null : 'volumeKuub',
    result.leverdatum ? null : 'leverdatum',
  ].filter(Boolean) as string[];
  const warnings: string[] = [];

  if (
    spec.expectedBetonkwaliteit &&
    normalizeUpper(result.betonkwaliteit) !== normalizeUpper(spec.expectedBetonkwaliteit)
  ) {
    warnings.push(
      `Betonkwaliteit wijkt af van projectspecificatie (${spec.expectedBetonkwaliteit}).`
    );
  }

  if (
    spec.expectedMilieuklasse &&
    normalizeUpper(result.milieuklasse) !== normalizeUpper(spec.expectedMilieuklasse)
  ) {
    warnings.push(
      `Milieuklasse wijkt af van projectspecificatie (${spec.expectedMilieuklasse}).`
    );
  }

  if (result.volumeKuub != null) {
    const numericVolume = Number(result.volumeKuub);

    if (
      spec.minVolumeKuub != null &&
      Number.isFinite(numericVolume) &&
      numericVolume < spec.minVolumeKuub
    ) {
      warnings.push(`Volume ligt onder minimum (${spec.minVolumeKuub} m3).`);
    }

    if (
      spec.maxVolumeKuub != null &&
      Number.isFinite(numericVolume) &&
      numericVolume > spec.maxVolumeKuub
    ) {
      warnings.push(`Volume ligt boven maximum (${spec.maxVolumeKuub} m3).`);
    }
  }

  if (
    spec.expectedLeverdatum &&
    result.leverdatum &&
    normalizeDateToken(result.leverdatum) !== normalizeDateToken(spec.expectedLeverdatum)
  ) {
    warnings.push(
      `Leverdatum wijkt af van projectspecificatie (${spec.expectedLeverdatum}).`
    );
  }

  const matchedSpec = warnings.length === 0;

  return {
    passed: missingFields.length === 0 && matchedSpec,
    matchedSpec,
    missingFields,
    warnings,
  };
};

/**
 * Scant een geuploade foto van een betonbon en extraheert Wkb-relevante metadata.
 * Indien projectspecificaties zijn meegegeven, wordt de bon direct gevalideerd.
 */
const scanBetonbonOCR = async (
  imageBuffer: Buffer,
  spec: BetonbonSpec = {}
): Promise<BetonbonData> => {
  console.log('🔍 Start OCR-analyse van de betonbon...');

  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imageBuffer, 'nld');

    const normalizedText = normalizeWhitespace(text);
    const parsed = {
      betonkwaliteit: extractBetonkwaliteit(normalizedText),
      milieuklasse: extractMilieuklasse(normalizedText),
      volumeKuub: extractVolume(normalizedText),
      leverdatum: extractLeverdatum(normalizedText),
      ruweTekst: normalizedText,
    };

    return {
      ...parsed,
      validation: validateBetonbonData(parsed, spec),
    };
  } catch (error: any) {
    console.error('❌ Fout tijdens OCR verwerking:', error?.message ?? error);
    throw new Error('Kon de betonbon niet digitaal uitlezen.');
  }
};

module.exports = {
  extractBetonkwaliteit,
  extractLeverdatum,
  extractMilieuklasse,
  extractVolume,
  normalizeWhitespace,
  scanBetonbonOCR,
  validateBetonbonData,
};
