/**
 * useEvidenceRepository — geeft de juiste EvidenceRepository terug op basis
 * van de offline-mode toggle van de actieve tenant.
 *
 * Gebruik in schermen ipv directe imports uit cloudEvidenceService:
 *
 *   const repo = useEvidenceRepository();
 *   const records = await repo.listForReview(projectId);
 *
 * Bij offline_mode = false (default) → cloudEvidenceRepository (Supabase direct)
 * Bij offline_mode = true → localEvidenceRepository (SQLite, week 2+)
 *
 * Onderdeel van Dual-Mode architectuur — schermen weten NIET in welke
 * mode ze draaien, het repository regelt het transparant.
 */

import {
  cloudEvidenceRepository,
  localEvidenceRepository,
  type EvidenceRepository,
} from '../services/EvidenceRepository';
import { useOfflineMode } from './useOfflineMode';

export function useEvidenceRepository(): EvidenceRepository {
  const offline = useOfflineMode();
  return offline ? localEvidenceRepository : cloudEvidenceRepository;
}
