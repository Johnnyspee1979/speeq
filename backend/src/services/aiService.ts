const axios = require('axios');
const { OpenAI } = require('openai');
const { backendConfig } = require('../config');
const { sendAiFallbackAlertEmail } = require('./emailService');

export interface WkbTemplate {
  id: string;
  nenNorm: string;
  discipline: 'Constructie' | 'Installatie' | 'Brandveiligheid' | 'Bouwfysica' | 'Afbouw';
  title: string;
  instruction: string;
  requiresMeasurementTool?: boolean;
  requiresTimer?: boolean;
  aiValidationKey?: string;
}

type WkbValidationResult = {
  status: 'PASSED' | 'FAILED' | 'NEEDS_REVIEW';
  confidence: number;
  detectedObjects: string[];
  feedback: string;
  checks: string[];
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeInspectionPoint = (inspectionPoint: string) => {
  const normalized = inspectionPoint.trim().toLowerCase();

  if (normalized.includes('wapening')) {
    return 'wapening';
  }

  return normalized;
};

// Prepared for a later switch to an external AI microservice.
const postToExternalValidator = async (imageUrl: string, inspectionPoint: string) =>
  axios.post(
    backendConfig.aiValidatorUrl,
    {
      image: imageUrl,
      type: inspectionPoint,
    },
    {
      timeout: backendConfig.aiValidatorTimeoutMs,
    }
  );

const buildSystemPrompt = (template?: WkbTemplate) => {
  let prompt = "You are a professional construction quality inspector in the Netherlands checking evidence for the 'Wet kwaliteitsborging voor het bouwen' (Wkb). Analyze the provided image against the requested inspection point. Return a JSON object without any markdown wrapping (just the braces and content) with: 'status' ('PASSED', 'FAILED', or 'NEEDS_REVIEW'), 'confidence' (number 0-1), 'detectedObjects' (array of strings), 'feedback' (string in Dutch explaining the finding), 'checks' (array of string checks performed).";
  
  if (template) {
    prompt += `\n\nSpecific instructions for this inspection point (${template.title}):\n${template.instruction}`;
    
    if (template.requiresMeasurementTool) {
      prompt += `\n\nCRITICAL: This inspection explicitly requires a measurement tool (like a tape measure/rolmaat or spirit level/waterpas) to be clearly visible and correctly used in the photo. If it is not present or readable, the status MUST be 'FAILED' or 'NEEDS_REVIEW'.`;
    }
    
    if (template.aiValidationKey) {
      prompt += `\n\nAdditional AI Validation Key Context: ${template.aiValidationKey}`;
    }
  }
  
  return prompt;
};

const validateEvidenceWithGemini = async (
  imageUrl: string,
  inspectionPoint: string,
  template?: WkbTemplate,
  apiKeyOverride?: string
): Promise<WkbValidationResult> => {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('No GEMINI_API_KEY provided.');
  }

  const systemPrompt = buildSystemPrompt(template);
  const normalizedInspectionPoint = normalizeInspectionPoint(inspectionPoint);

  const payload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: `Controleer deze foto voor het Wkb-inspectiepunt: ${normalizedInspectionPoint}` },
          { text: `Image URL: ${imageUrl} (Analyze the image at this URL)` }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
    }
  };

  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
    const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';

    // 2026-05-29 bug fix: Gemini's API accepteert geen part met BÁDE text + inlineData.
    // Originele code voegde inlineData toe aan part[1] dat al een text-veld had → HTTP 400.
    // Fix: vervang part[1] volledig met alleen inlineData.
    if (payload.contents[0]?.parts?.[1]) {
      (payload.contents[0].parts[1] as any) = {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      };
    }
  } catch (e) {
    console.warn('[AI Service] Kon afbeelding niet downloaden voor Gemini. Probeert URL mee te sturen.', e);
  }

  // 2026-05-29: gemini-1.5-flash deprecated door Google (HTTP 404).
  // gemini-2.5-flash-lite werkt maar gratis-tier quota is 20 req/dag — te krap.
  // Vervangen door gemini-flash-latest (auto-tracks nieuwste stable flash).
  // Timeout 90s: Railway US-West → Google API met grote inline images
  // kan 30-60s duren. UX-perf-actie staat in roadmap (async queue + closer region).
  const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, payload, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 90000
  });

  const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(cleanContent);

  return {
    status: result.status || 'NEEDS_REVIEW',
    confidence: result.confidence || 0,
    detectedObjects: result.detectedObjects || [],
    feedback: result.feedback || 'AI analyse voltooid door Gemini.',
    checks: result.checks || ['gemini-vision-analyse']
  };
};

const validateEvidenceWithOpenAI = async (
  imageUrl: string,
  inspectionPoint: string,
  template?: WkbTemplate
): Promise<WkbValidationResult> => {
  const apiKey = backendConfig.openaiApiKey;

  if (!apiKey) {
    throw new Error('No OPENAI_API_KEY provided.');
  }

  const openai = new OpenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(template);
  const normalizedInspectionPoint = normalizeInspectionPoint(inspectionPoint);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Controleer deze foto voor het Wkb-inspectiepunt: ${normalizedInspectionPoint}` },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const content = response.choices[0].message.content || '{}';
  const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(cleanContent);

  return {
    status: result.status || 'NEEDS_REVIEW',
    confidence: result.confidence || 0,
    detectedObjects: result.detectedObjects || [],
    feedback: result.feedback || 'AI analyse voltooid door OpenAI gpt-4o.',
    checks: result.checks || ['openai-vision-analyse']
  };
};

const validateEvidenceImage = async (
  imageUrl: string,
  inspectionPoint: string,
  template?: WkbTemplate
): Promise<WkbValidationResult> => {
  try {
    const normalizedInspectionPoint = normalizeInspectionPoint(inspectionPoint);

    console.log(
      `[AI Service] Analyseren van bewijs voor: ${normalizedInspectionPoint} (${imageUrl})`
    );

    // Try Gemini first as it's typically faster and more cost-effective for these checks
    let geminiErrorMsg: string | undefined;
    let openaiErrorMsg: string | undefined;
    try {
      console.log('[AI Service] Proberen met Gemini API...');
      const geminiResult = await validateEvidenceWithGemini(imageUrl, inspectionPoint, template);
      return geminiResult;
    } catch (geminiError: any) {
      geminiErrorMsg = geminiError?.message ?? String(geminiError);
      console.warn('[AI Service] Gemini (primair) gefaald of niet ingesteld.', geminiErrorMsg);

      // Reservelijn 1: tweede Gemini-sleutel (aparte quota / vangt key-uitval op)
      const fallbackGeminiKey = process.env.GEMINI_FALLBACK_API_KEY;
      if (fallbackGeminiKey) {
        try {
          console.log('[AI Service] Proberen met Gemini fallback-sleutel...');
          const geminiFallbackResult = await validateEvidenceWithGemini(
            imageUrl,
            inspectionPoint,
            template,
            fallbackGeminiKey
          );
          return geminiFallbackResult;
        } catch (geminiFallbackError: any) {
          const msg = geminiFallbackError?.message ?? String(geminiFallbackError);
          console.warn('[AI Service] Gemini fallback-sleutel ook gefaald.', msg);
          geminiErrorMsg = `${geminiErrorMsg} | fallback-key: ${msg}`;
        }
      }

      // Reservelijn 2: OpenAI (indien geconfigureerd)
      try {
        console.log('[AI Service] Proberen met OpenAI API fallback...');
        const openaiResult = await validateEvidenceWithOpenAI(imageUrl, inspectionPoint, template);
        return openaiResult;
      } catch (openaiError: any) {
        openaiErrorMsg = openaiError?.message ?? String(openaiError);
        console.warn('[AI Service] OpenAI API fallback ook gefaald of niet ingesteld.', openaiErrorMsg);
        const bothFailed: any = new Error('Beide AI services gefaald.');
        bothFailed.geminiError = geminiErrorMsg;
        bothFailed.openaiError = openaiErrorMsg;
        throw bothFailed;
      }
    }
  } catch (error: any) {
    const normalizedInspectionPoint = normalizeInspectionPoint(inspectionPoint);

    // Structured log zodat een log-drain (Railway/Sentry) hierop kan alerten.
    console.error(
      '[AI Service] MOCK_FALLBACK_TRIGGERED',
      JSON.stringify({
        event: 'ai_mock_fallback',
        inspectionPoint: normalizedInspectionPoint,
        imageUrl,
        geminiError: error?.geminiError,
        openaiError: error?.openaiError,
        message: error?.message,
        at: new Date().toISOString(),
      })
    );

    // E-mail alert (fire-and-forget): zo blijft een stille degradatie niet
    // onopgemerkt. Faalt het mailen, dan logt emailService dat zelf — de
    // validatie zelf mag er nooit op vastlopen.
    void sendAiFallbackAlertEmail({
      inspectionPoint: normalizedInspectionPoint,
      imageUrl,
      geminiError: error?.geminiError,
      openaiError: error?.openaiError,
    }).catch(() => undefined);

    // Fallback: FAIL-CLOSED. Bij totale AI-uitval mag niets automatisch worden
    // goedgekeurd — een PASSED-mock wordt gedegradeerd naar NEEDS_REVIEW zodat een
    // werkvoorbereider het bewijs altijd handmatig beoordeelt. Anders zou bewijs
    // (bijv. 'wapening') als goedgekeurd in het Wkb-dossier belanden zonder dat er
    // ooit een analyse heeft plaatsgevonden.
    const mock = getMockResult(normalizedInspectionPoint);
    if (mock.status === 'PASSED') {
      return {
        ...mock,
        status: 'NEEDS_REVIEW',
        confidence: 0.5,
        feedback:
          'AI-analyse tijdelijk niet beschikbaar — automatische goedkeuring is uitgeschakeld. Handmatige review vereist (fail-closed fallback).',
        checks: [...mock.checks, 'fail-closed-geen-auto-goedkeuring'],
      };
    }
    return mock;
  }
};

const getMockResult = (normalizedInspectionPoint: string): WkbValidationResult => {
  if (normalizedInspectionPoint === 'wapening') {
    return {
      status: 'PASSED',
      confidence: 0.92,
      detectedObjects: ['wapeningsstaal', 'betonblok', 'vlechtkruis'],
      feedback: 'Wapening correct gedetecteerd (MOCK fallback). Kwaliteit foto is voldoende.',
      checks: ['beeldanalyse-mock', 'wapening-gedetecteerd'],
    };
  }

  if (
    normalizedInspectionPoint.includes('isolatie') ||
    normalizedInspectionPoint.includes('brand')
  ) {
    return {
      status: 'NEEDS_REVIEW',
      confidence: 0.61,
      detectedObjects: ['mogelijk_constructieonderdeel'],
      feedback:
        'Inspectiepunt herkend, maar dit type vraagt nog om handmatige review (MOCK fallback).',
      checks: ['beeldanalyse-mock', 'handmatige-review-nodig'],
    };
  }

  return {
    status: 'FAILED',
    confidence: 0.45,
    detectedObjects: ['onbekend_object', 'hand'],
    feedback:
      'Let op: Geen duidelijke wapening of isolatie gedetecteerd (MOCK fallback).',
    checks: ['beeldanalyse-mock', 'geen-herkenbaar-patroon'],
  };
};

module.exports = {
  validateEvidenceImage,
};
