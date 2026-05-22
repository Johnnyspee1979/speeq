/**
 * LocalAIService — Week 5 van de Offline-Mode roadmap.
 *
 * On-device AI-precheck zonder cloud-call. Bedoeld voor de bouwplaats
 * waar geen netwerk is — vakman krijgt direct feedback ("scherp genoeg /
 * te vaag / overbelicht") zonder te wachten op cloud-AI.
 *
 * Twee onderdelen:
 *  1. analyzeImageBlur(uri)    — Laplacian variance via canvas
 *                                Pure JavaScript, geen ML-lib nodig.
 *                                Werkt op web (Canvas API) en RN-web.
 *  2. analyzeImageCategory(uri) — stub die 'unknown' returneert.
 *                                Vervangen door MobileNet TFLite in
 *                                een latere sprint (zie roadmap §6).
 *
 * Beide returneren een AIVerdict met confidence-score zodat de
 * UI consistent kan reageren — identiek aan cloud-AI shape.
 *
 * Bij netwerk-terug kan cloud-AI deze lokale beoordeling overrulen
 * door een hogere confidence-score. Zie OfflineSyncEngine voor de
 * conflict-flow.
 *
 * Onderdeel van docs/strategie/dual-mode-architectuur.md (§6).
 */

import { Platform } from 'react-native';

// ─── Public types ────────────────────────────────────────────────────────────

export type AIStatus = 'PASSED' | 'WARNING' | 'FAILED' | 'NEEDS_REVIEW';

export interface AIVerdict {
  status: AIStatus;
  confidence: number; // 0..1
  notes: string;
  /**
   * Tag waarmee we lokale beslissingen kunnen onderscheiden van cloud-AI.
   * Set op 'local-blur' / 'local-category' / 'local-stub'.
   */
  source: 'local-blur' | 'local-category' | 'local-stub';
}

export interface LocalAIService {
  analyzeImageBlur(uri: string): Promise<AIVerdict>;
  analyzeImageCategory(uri: string): Promise<AIVerdict>;
}

// ─── Tunables ────────────────────────────────────────────────────────────────

/**
 * Laplacian variance drempelwaarden. Lager = waziger.
 * Gekalibreerd op fundering/wapening-foto's (bouwplaats-context).
 *
 * Boven 250 = scherp genoeg om als bewijs te dienen.
 * 100–250  = twijfelgeval, escaleer naar werkvoorbereider.
 * Onder 100 = te wazig — vraag vakman om opnieuw te maken.
 */
const BLUR_THRESHOLD_PASS = 250;
const BLUR_THRESHOLD_WARN = 100;

// ─── Helper: laad een afbeelding naar een canvas + return pixel-data ────────

async function loadImageData(uri: string): Promise<ImageData | null> {
  if (typeof document === 'undefined') {
    // Native runtime — pixel-data extractie vereist react-native-image-tools
    // of vergelijkbaar. Voorlopig: ongedefinieerd → fallback naar cloud.
    return null;
  }

  return new Promise<ImageData | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Downsamplen naar max 256px breed voor snelle inference (~50ms)
        const ratio = Math.min(256 / img.width, 1);
        const w = Math.max(32, Math.round(img.width * ratio));
        const h = Math.max(32, Math.round(img.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(ctx.getImageData(0, 0, w, h));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

// ─── Blur-detect via Laplacian variance ─────────────────────────────────────

function luminance(r: number, g: number, b: number): number {
  // ITU-R BT.709 luma
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function laplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;

  // Convert naar grijswaarden (één pass)
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const px = i * 4;
    gray[i] = luminance(data[px], data[px + 1], data[px + 2]);
  }

  // Laplacian kernel: [[0,1,0],[1,-4,1],[0,1,0]]
  // Variance van de filter-output = scherpheids-proxy
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - width] +
        gray[i + width];
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

// ─── Implementation ─────────────────────────────────────────────────────────

const localAIServiceImpl: LocalAIService = {
  async analyzeImageBlur(uri: string): Promise<AIVerdict> {
    const imageData = await loadImageData(uri);
    if (!imageData) {
      return {
        status: 'NEEDS_REVIEW',
        confidence: 0.3,
        notes:
          'Pixel-data niet beschikbaar op dit platform — laat cloud-AI dit later beoordelen.',
        source: 'local-stub',
      };
    }

    const variance = laplacianVariance(imageData);

    if (variance >= BLUR_THRESHOLD_PASS) {
      return {
        status: 'PASSED',
        confidence: Math.min(0.95, variance / 1000),
        notes: `Scherpheid OK (lap-variance ${Math.round(variance)})`,
        source: 'local-blur',
      };
    }

    if (variance >= BLUR_THRESHOLD_WARN) {
      return {
        status: 'WARNING',
        confidence: 0.5,
        notes: `Twijfelgeval — wat wazig (lap-variance ${Math.round(variance)}). Werkvoorbereider beoordeelt.`,
        source: 'local-blur',
      };
    }

    return {
      status: 'FAILED',
      confidence: 0.85,
      notes: `Te wazig (lap-variance ${Math.round(variance)}). Maak een nieuwe foto.`,
      source: 'local-blur',
    };
  },

  async analyzeImageCategory(uri: string): Promise<AIVerdict> {
    // On-device MobileNet via LocalMobileNetClassifier (lazy-loaded).
    // Werkt web-only — op native valt 'ie terug op 'unknown' en laat
    // cloud-AI de categorisatie doen bij sync.
    try {
      const { classifyPhotoCategory } = await import('./LocalMobileNetClassifier');
      const prediction = await classifyPhotoCategory(uri);

      if (prediction.category === 'unknown') {
        return {
          status: 'NEEDS_REVIEW',
          confidence: 0,
          notes:
            'Lokale categorisatie niet beschikbaar op dit toestel — cloud-AI doet het bij sync.',
          source: 'local-stub',
        };
      }

      // Confidence >= 0.5 = PASSED, anders WARNING (laat werkvoorbereider checken)
      const status = prediction.confidence >= 0.5 ? 'PASSED' : 'WARNING';
      return {
        status,
        confidence: prediction.confidence,
        notes: `Categorie: ${prediction.category} (MobileNet: ${prediction.rawLabel})`,
        source: 'local-category',
      };
    } catch (err) {
      console.warn('[LocalAIService] categorisatie faalt:', err);
      return {
        status: 'NEEDS_REVIEW',
        confidence: 0,
        notes: 'Categorisatie tijdelijk niet beschikbaar — cloud-AI bepaalt het bij sync.',
        source: 'local-stub',
      };
    }
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Geeft de LocalAIService-singleton terug. Op web werkt blur-detect direct;
 * op native runtime valt deze methode tijdelijk terug op 'NEEDS_REVIEW'
 * tot we react-native-image-tools toevoegen (volgende sprint).
 */
export function getLocalAIService(): LocalAIService {
  return localAIServiceImpl;
}

/**
 * Check of lokale AI op dit platform beschikbaar is.
 * Schermen kunnen hiermee de UI aanpassen ("lokaal beoordeeld" badge).
 */
export function isLocalAIAvailable(): boolean {
  return Platform.OS === 'web' || typeof document !== 'undefined';
}
