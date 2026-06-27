/**
 * @jest-environment node
 *
 * Unit-tests voor LocalAIService — on-device AI-precheck zonder cloud-call
 * (bouwplaats-context). We draaien bewust in de `node`-omgeving zodat
 * `typeof document === 'undefined'` waar is: dat dekt de native/zonder-canvas
 * tak deterministisch af (blur valt terug op cloud, isLocalAIAvailable hangt
 * dan puur op Platform.OS).
 *
 * Platform is mutabel zodat we web/native kunnen wisselen. De category-tak laadt
 * `./LocalMobileNetClassifier` lazy (dynamic import), die we mocken. We borgen:
 *   - isLocalAIAvailable: web → true; native (zonder document) → false;
 *   - analyzeImageBlur: zonder pixel-data → NEEDS_REVIEW/local-stub;
 *   - analyzeImageCategory: unknown → NEEDS_REVIEW/local-stub, bekend met
 *     confidence ≥ 0.5 → PASSED/local-category, < 0.5 → WARNING/local-category,
 *     en een fout in de classifier → NEEDS_REVIEW/local-stub.
 */

const mockPlatform = { OS: 'web' as string };
jest.mock('react-native', () => ({ Platform: mockPlatform }));

const mockClassify = jest.fn();
jest.mock('../LocalMobileNetClassifier', () => ({
  classifyPhotoCategory: (...a: unknown[]) => mockClassify(...a),
}));

import {
  getLocalAIService,
  isLocalAIAvailable,
} from '../LocalAIService';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'web';
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('isLocalAIAvailable', () => {
  it('is true op web', () => {
    mockPlatform.OS = 'web';
    expect(isLocalAIAvailable()).toBe(true);
  });

  it('is false op native zonder document (canvas niet beschikbaar)', () => {
    mockPlatform.OS = 'ios';
    expect(isLocalAIAvailable()).toBe(false);
  });
});

describe('analyzeImageBlur', () => {
  it('valt terug op NEEDS_REVIEW/local-stub zonder pixel-data', async () => {
    const svc = getLocalAIService();
    const v = await svc.analyzeImageBlur('file://foto.jpg');
    expect(v.status).toBe('NEEDS_REVIEW');
    expect(v.source).toBe('local-stub');
    expect(v.confidence).toBe(0.3);
    expect(v.notes).toMatch(/cloud-AI/i);
  });
});

describe('analyzeImageCategory', () => {
  it('unknown → NEEDS_REVIEW/local-stub (confidence 0)', async () => {
    mockClassify.mockResolvedValue({ category: 'unknown', confidence: 0, rawLabel: '' });
    const svc = getLocalAIService();
    const v = await svc.analyzeImageCategory('file://foto.jpg');
    expect(v).toMatchObject({ status: 'NEEDS_REVIEW', source: 'local-stub', confidence: 0 });
    expect(mockClassify).toHaveBeenCalledWith('file://foto.jpg');
  });

  it('bekend met confidence ≥ 0.5 → PASSED/local-category', async () => {
    mockClassify.mockResolvedValue({ category: 'wapening', confidence: 0.82, rawLabel: 'rebar' });
    const svc = getLocalAIService();
    const v = await svc.analyzeImageCategory('file://foto.jpg');
    expect(v).toMatchObject({
      status: 'PASSED',
      source: 'local-category',
      confidence: 0.82,
    });
    expect(v.notes).toContain('wapening');
    expect(v.notes).toContain('rebar');
  });

  it('bekend met confidence < 0.5 → WARNING/local-category', async () => {
    mockClassify.mockResolvedValue({ category: 'fundering', confidence: 0.41, rawLabel: 'foundation' });
    const svc = getLocalAIService();
    const v = await svc.analyzeImageCategory('file://foto.jpg');
    expect(v).toMatchObject({
      status: 'WARNING',
      source: 'local-category',
      confidence: 0.41,
    });
  });

  it('classifier-fout → NEEDS_REVIEW/local-stub', async () => {
    mockClassify.mockRejectedValue(new Error('tfjs niet geladen'));
    const svc = getLocalAIService();
    const v = await svc.analyzeImageCategory('file://foto.jpg');
    expect(v).toMatchObject({ status: 'NEEDS_REVIEW', source: 'local-stub', confidence: 0 });
  });
});
