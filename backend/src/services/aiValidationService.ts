type AiValidationResult = {
  status: 'APPROVED' | 'REJECTED' | 'WARNING';
  confidence: number;
  findings: string[];
};

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Simuleert de Computer Vision AI pipeline voor Wkb wapeningscontrole.
 * In productie stuur je de imageBuffer hier naar een aparte AI-microservice.
 */
const validateEvidenceWithAI = async (
  imageBuffer: Buffer,
  inspectionPointId: string
): Promise<AiValidationResult> => {
  const normalizedInspectionPoint = inspectionPointId.trim().toUpperCase();

  console.log(`🧠 Start AI-analyse voor inspectiepunt: ${normalizedInspectionPoint}...`);

  // Houd de buffer expliciet "gebruikt" zodat de mock dezelfde interface kan houden.
  void imageBuffer;
  await sleep(1500);

  if (normalizedInspectionPoint.includes('WAPENING')) {
    return {
      status: 'APPROVED',
      confidence: 0.94,
      findings: [
        'Wapeningsstaal correct gedetecteerd.',
        'Geen significante roestvorming waargenomen.',
        'Scherpte van de foto is voldoende voor het Dossier Bevoegd Gezag.',
      ],
    };
  }

  return {
    status: 'WARNING',
    confidence: 0.75,
    findings: ['Object herkend, maar vereist menselijke controle door kwaliteitsborger.'],
  };
};

module.exports = {
  validateEvidenceWithAI,
};
