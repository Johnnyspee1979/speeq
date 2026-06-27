/**
 * Unit-tests voor useEvidenceRepository — kiest transparant de juiste
 * EvidenceRepository op basis van de offline-mode toggle (Dual-Mode).
 *
 * offline_mode = false (default) → cloudEvidenceRepository
 * offline_mode = true            → localEvidenceRepository
 *
 * We mocken `../useOfflineMode` (zodat we de toggle kunnen variëren) en
 * `../../services/EvidenceRepository` (twee herkenbare sentinel-objecten).
 * We borgen beide takken en dat de keuze meeverandert wanneer de toggle wisselt.
 */

const mockUseOfflineMode = jest.fn<boolean, unknown[]>(() => false);
jest.mock('../useOfflineMode', () => ({
  useOfflineMode: (...a: unknown[]) => mockUseOfflineMode(...a),
}));

const cloudRepo = { __kind: 'cloud' };
const localRepo = { __kind: 'local' };
jest.mock('../../services/EvidenceRepository', () => ({
  cloudEvidenceRepository: cloudRepo,
  localEvidenceRepository: localRepo,
}));

import { renderHook } from '@testing-library/react-native';
import { useEvidenceRepository } from '../useEvidenceRepository';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOfflineMode.mockReturnValue(false);
});

describe('useEvidenceRepository', () => {
  it('kiest de cloud-repository bij offline_mode = false', () => {
    mockUseOfflineMode.mockReturnValue(false);
    const { result } = renderHook(() => useEvidenceRepository());
    expect(result.current).toBe(cloudRepo);
  });

  it('kiest de local-repository bij offline_mode = true', () => {
    mockUseOfflineMode.mockReturnValue(true);
    const { result } = renderHook(() => useEvidenceRepository());
    expect(result.current).toBe(localRepo);
  });

  it('wisselt mee wanneer de toggle verandert bij rerender', () => {
    mockUseOfflineMode.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useEvidenceRepository());
    expect(result.current).toBe(cloudRepo);

    mockUseOfflineMode.mockReturnValue(true);
    rerender(undefined);
    expect(result.current).toBe(localRepo);
  });
});
