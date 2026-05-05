const normalizeBase64 = (rawImage: string) => rawImage.replace(/\s+/g, '');

/**
 * Edge AI: controleert lokaal en razendsnel of de foto voldoende detail bevat.
 * Dit is een lichte MVP-heuristiek totdat we een echt on-device model aansluiten.
 */
export const checkImageSharpnessLocal = async (
  base64Image: string
): Promise<boolean> => {
  console.log('🧠 Edge AI: beoordelen van foto-scherpte op het apparaat...');

  const normalized = normalizeBase64(base64Image);
  const sample = normalized.slice(0, Math.min(normalized.length, 6000));

  if (!sample) {
    return false;
  }

  let transitions = 0;
  for (let index = 1; index < sample.length; index += 1) {
    if (sample[index] !== sample[index - 1]) {
      transitions += 1;
    }
  }

  const textureScore = transitions / sample.length;
  const hasEnoughSignal = normalized.length >= 120_000;
  const isSharpEnough = hasEnoughSignal && textureScore > 0.72;

  if (!isSharpEnough) {
    console.warn('⚠️ Edge AI heeft lokale kwaliteitsproblemen gedetecteerd.');
  }

  return isSharpEnough;
};
