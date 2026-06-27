/**
 * Unit-tests voor useTenantFeature — leest één feature-toggle voor de actieve
 * tenant, met een module-level cache + abonnees zodat een toggle alle gebruikers
 * reactief bijwerkt.
 *
 * We mocken `../../services/TenantFeaturesService` (getTenantFeatures async +
 * een afgebakende FEATURE_META met defaultOn-waarden). De `cache` leeft op
 * module-niveau; we kunnen die niet vers herladen zonder React te dupliceren
 * (isolateModules → "Invalid hook call"). Daarom draait deze suite bewust
 * SEQUENTIEEL tegen één module-instantie: de eerste test ziet de lege cache, de
 * latere bouwen daarop voort. We borgen: defaultOn als initiële waarde + fetch,
 * directe cache-lezing zonder extra fetch, reactieve update via
 * refreshTenantFeatures, en useAllTenantFeatures.
 */

const mockGetTenantFeatures = jest.fn<Promise<any>, unknown[]>();
jest.mock('../../services/TenantFeaturesService', () => ({
  getTenantFeatures: (...a: unknown[]) => mockGetTenantFeatures(...a),
  FEATURE_META: {
    ai_review: { key: 'ai_review', defaultOn: true },
    simple_mode: { key: 'simple_mode', defaultOn: false },
    voice_assistant: { key: 'voice_assistant', defaultOn: false },
  },
  FEATURE_KEYS: ['ai_review', 'simple_mode', 'voice_assistant'],
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  useTenantFeature,
  useAllTenantFeatures,
  refreshTenantFeatures,
} from '../useTenantFeature';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantFeatures.mockResolvedValue({
    ai_review: false,
    simple_mode: true,
    voice_assistant: false,
  });
});

describe('useTenantFeature (sequentieel, gedeelde module-cache)', () => {
  it('1) start op defaultOn (lege cache) en haalt daarna de features op', async () => {
    const { result } = renderHook(() => useTenantFeature('ai_review'));
    // ai_review defaultOn = true vóór de fetch
    expect(result.current).toBe(true);
    // na de fetch → false (uit de service); cache is nu gevuld
    await waitFor(() => expect(result.current).toBe(false));
    expect(mockGetTenantFeatures).toHaveBeenCalledTimes(1);
  });

  it('2) cache gevuld → leest direct, geen extra fetch', async () => {
    const { result } = renderHook(() => useTenantFeature('simple_mode'));
    await waitFor(() => expect(result.current).toBe(true));
    expect(mockGetTenantFeatures).not.toHaveBeenCalled();
  });

  it('3) refreshTenantFeatures werkt gemounte abonnees reactief bij', async () => {
    const { result } = renderHook(() => useTenantFeature('ai_review'));
    await waitFor(() => expect(result.current).toBe(false));

    mockGetTenantFeatures.mockResolvedValue({
      ai_review: true,
      simple_mode: true,
      voice_assistant: false,
    });
    await act(async () => {
      await refreshTenantFeatures();
    });
    expect(result.current).toBe(true);
  });
});

describe('useAllTenantFeatures', () => {
  it('geeft de features en een refresh-functie terug (cache reeds gevuld)', async () => {
    const { result } = renderHook(() => useAllTenantFeatures());
    await waitFor(() =>
      expect(result.current.features).toMatchObject({ simple_mode: true }),
    );
    expect(typeof result.current.refresh).toBe('function');
    expect(result.current.loading).toBe(false);
  });
});
