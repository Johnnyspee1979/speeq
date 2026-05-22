/**
 * LocalMobileNetClassifier — on-device foto-categorisatie via MobileNet v2.
 *
 * Vervangt de stub in LocalAIService.analyzeImageCategory door echte
 * machine-learning op het toestel — werkt zonder netwerk, zonder cloud-call.
 *
 * Werking:
 *   1. Lazy-load van @tensorflow/tfjs + @tensorflow-models/mobilenet (~3-5 MB).
 *      Pas bij eerste aanroep wordt het model gedownload (~16 MB cache eerste keer).
 *   2. Classify top-5 ImageNet-categorieën.
 *   3. WKB-mapping laag vertaalt ImageNet-labels naar bouwspecifieke buckets
 *      (fundering / wapening / isolatie / etc.).
 *   4. Bij netwerk-terug kan cloud-AI deze lokale beoordeling overrulen
 *      door een hogere confidence-score.
 *
 * Platform-strategie:
 *   - Web (incl. RN-web): volledig ondersteund.
 *   - Native (iOS/Android RN): valt terug op 'unknown' — TFLite vereist
 *     een aparte native rebuild met @tensorflow/tfjs-react-native.
 *
 * Bundle-impact: lazy-loaded, dus 0 KB toegevoegd aan initial bundle.
 * Pas bij eerste foto-capture in offline-mode wordt TF.js binnengehaald.
 *
 * Onderdeel van docs/strategie/offline-mode-roadmap.md week 5 — lokale AI.
 */

import { Platform } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WkbCategory =
  | 'fundering'
  | 'wapening'
  | 'beton'
  | 'isolatie'
  | 'metselwerk'
  | 'staal'
  | 'hout'
  | 'kabels'
  | 'leidingen'
  | 'dak'
  | 'gereedschap'
  | 'persoon'
  | 'overig'
  | 'unknown';

export interface CategoryPrediction {
  category: WkbCategory;
  confidence: number;
  rawLabel: string;
  alternates: Array<{ label: string; score: number }>;
}

// ─── Lazy-loaded model singleton ────────────────────────────────────────────

interface MobileNetClassification {
  className: string;
  probability: number;
}

interface MobileNetModel {
  classify(
    img: HTMLImageElement | HTMLCanvasElement | ImageData,
    topk?: number,
  ): Promise<MobileNetClassification[]>;
}

let modelPromise: Promise<MobileNetModel | null> | null = null;

async function getModel(): Promise<MobileNetModel | null> {
  if (modelPromise) return modelPromise;
  if (!isCategorizationSupported()) return null;

  modelPromise = (async () => {
    try {
      // Dynamic import zodat bundle alleen groeit bij eerste gebruik.
      const tf = await import('@tensorflow/tfjs');
      const mobilenetModule = await import('@tensorflow-models/mobilenet');
      // Wacht tot tfjs backend klaar is — voorkomt race-bij-eerste-classify
      await tf.ready();
      const model = await mobilenetModule.load({
        version: 2,
        alpha: 1.0,
      });
      return model as unknown as MobileNetModel;
    } catch (err) {
      console.warn('[MobileNet] kon model niet laden:', err);
      return null;
    }
  })();

  return modelPromise;
}

// ─── WKB-mapping van ImageNet-labels ────────────────────────────────────────

/**
 * Mapping van ImageNet-keywords naar WKB-categorieën. Een ImageNet-label
 * kan meerdere zoekwoorden bevatten (kommagescheiden); we splitsen en
 * checken op substring-match.
 */
const WKB_KEYWORD_MAP: Record<WkbCategory, string[]> = {
  fundering: ['foundation', 'concrete block', 'breakwater', 'dam'],
  wapening: ['chain mail', 'chainlink fence', 'wire fence', 'nail', 'screw', 'spike'],
  beton: ['concrete', 'cement', 'wall', 'stone wall', 'paving'],
  isolatie: ['cotton', 'wool', 'mat', 'matting', 'fiber', 'fibre', 'sponge'],
  metselwerk: ['brick', 'stone', 'cobble', 'tile roof', 'masonry'],
  staal: [
    'iron', 'steel', 'metal', 'pipe', 'tube', 'beam',
    'screw', 'bolt', 'nail',
  ],
  hout: ['wood', 'plank', 'beam', 'timber', 'plywood', 'log'],
  kabels: ['cable', 'wire', 'cord', 'electrical', 'plug'],
  leidingen: ['pipe', 'drainpipe', 'tube', 'hose', 'plumbing', 'faucet'],
  dak: ['roof', 'shingle', 'tile roof', 'thatch', 'gutter', 'chimney'],
  gereedschap: [
    'hammer', 'screwdriver', 'wrench', 'drill', 'saw', 'tool',
    'level', 'measuring', 'tape',
  ],
  persoon: ['person', 'man', 'woman', 'worker', 'helmet', 'hard hat'],
  overig: [], // catch-all, niet gebruikt voor matching
  unknown: [],
};

/**
 * Bereken WKB-categorie voor een top-5 MobileNet-resultaat.
 * Algoritme: voor elk top-resultaat, voor elke WKB-categorie, tel hoeveel
 * keywords matchen. Categorie met meeste matches × confidence wint.
 */
function mapToWkbCategory(
  predictions: MobileNetClassification[],
): CategoryPrediction {
  if (predictions.length === 0) {
    return {
      category: 'unknown',
      confidence: 0,
      rawLabel: '',
      alternates: [],
    };
  }

  const top = predictions[0];
  const alternates = predictions.slice(0, 5).map((p) => ({
    label: p.className,
    score: p.probability,
  }));

  // Score per categorie = som over alle top-5 predictions:
  //   keyword-matches × prediction.probability
  const scores = new Map<WkbCategory, number>();
  for (const pred of predictions) {
    const labelLower = pred.className.toLowerCase();
    for (const [cat, keywords] of Object.entries(WKB_KEYWORD_MAP) as Array<
      [WkbCategory, string[]]
    >) {
      if (cat === 'overig' || cat === 'unknown') continue;
      let matches = 0;
      for (const kw of keywords) {
        if (labelLower.includes(kw)) matches += 1;
      }
      if (matches > 0) {
        scores.set(
          cat,
          (scores.get(cat) ?? 0) + matches * pred.probability,
        );
      }
    }
  }

  if (scores.size === 0) {
    return {
      category: 'overig',
      confidence: top.probability,
      rawLabel: top.className,
      alternates,
    };
  }

  let bestCat: WkbCategory = 'overig';
  let bestScore = 0;
  for (const [cat, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }

  return {
    category: bestCat,
    confidence: Math.min(0.95, bestScore),
    rawLabel: top.className,
    alternates,
  };
}

// ─── Image-loading helper ───────────────────────────────────────────────────

async function loadImageElement(uri: string): Promise<HTMLImageElement | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Classificeer een foto naar een WKB-categorie via on-device MobileNet.
 *
 * Returns:
 *   - { category: 'unknown', ... } als platform niet ondersteund of model
 *     niet kon laden (cloud-AI handelt het dan af bij sync).
 *   - { category: <WKB-bucket>, confidence: 0..1, rawLabel, alternates }
 *     bij succes.
 */
export async function classifyPhotoCategory(
  uri: string,
): Promise<CategoryPrediction> {
  const model = await getModel();
  if (!model) {
    return {
      category: 'unknown',
      confidence: 0,
      rawLabel: '',
      alternates: [],
    };
  }

  const img = await loadImageElement(uri);
  if (!img) {
    return {
      category: 'unknown',
      confidence: 0,
      rawLabel: '',
      alternates: [],
    };
  }

  try {
    const predictions = await model.classify(img, 5);
    return mapToWkbCategory(predictions);
  } catch (err) {
    console.warn('[MobileNet] classify-fout:', err);
    return {
      category: 'unknown',
      confidence: 0,
      rawLabel: '',
      alternates: [],
    };
  }
}

/**
 * Check of on-device categorisatie op dit platform mogelijk is.
 */
export function isCategorizationSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof document === 'undefined') return false;
  return true;
}

/**
 * Voor tests — reset de gecachede model-promise zodat een volgende call
 * 'm opnieuw probeert te laden.
 * @internal
 */
export function __resetMobileNetForTests(): void {
  modelPromise = null;
}

/**
 * Exporteer de mapping-functie voor unit-tests zonder echt model te laden.
 * @internal
 */
export { mapToWkbCategory as __mapToWkbCategoryForTests };
