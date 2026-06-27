/**
 * @jest-environment node
 *
 * Gedrag-tests voor de keurmeester-/review-workflow (services/ReviewService.ts).
 * Deze module vertaalt UI-acties naar review-statussen en is de enige plek waar
 * de Supabase-RPC `set_evidence_review` wordt aangeroepen. Een fout hier laat een
 * afkeuring zonder toelichting door (terwijl de UI dat verbiedt) of toont de
 * verkeerde badge in zowel desktop als mobiel. We borgen de pure logica én het
 * contract richting de RPC, met een gemockte supabase-client:
 *  - actionToStatus mapt elke ReviewAction naar de juiste doel-status;
 *  - setEvidenceReview weigert REJECTED zonder (getrimde) toelichting VÓÓR de RPC;
 *  - setEvidenceReview stuurt p_evidence_id/p_status/p_note correct door
 *    (lege/whitespace note → null) en vertaalt RPC-fouten naar een Error;
 *  - de wrappers (approve/reject/finalize/reopen) zetten de juiste status;
 *  - reviewBadgeFor en isReviewLocked geven de juiste UI-tokens/lock-staat.
 *
 * supabase is volledig gemockt → geen netwerk/env nodig → @jest-environment node.
 */

jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { supabase } from '../../lib/supabase';
import {
  actionToStatus,
  setEvidenceReview,
  approveEvidence,
  rejectEvidence,
  finalizeEvidence,
  reopenEvidence,
  reviewBadgeFor,
  isReviewLocked,
  type ReviewAction,
} from '../ReviewService';
import type { ReviewStatus } from '../../types/Evidence';

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
});

describe('actionToStatus', () => {
  it('mapt elke actie naar de juiste status', () => {
    const expected: Record<ReviewAction, ReviewStatus> = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      FINALIZE: 'FINALIZED',
      REOPEN: 'PENDING_REVIEW',
    };
    for (const [action, status] of Object.entries(expected)) {
      expect(actionToStatus(action as ReviewAction)).toBe(status);
    }
  });
});

describe('setEvidenceReview', () => {
  it('weigert REJECTED zonder toelichting en raakt de RPC niet aan', async () => {
    await expect(
      setEvidenceReview({ cloudRecordId: 1, status: 'REJECTED', note: '   ' }),
    ).rejects.toThrow('Afkeuren kan alleen met een toelichting.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('stuurt een getrimde toelichting door naar de RPC', async () => {
    await setEvidenceReview({ cloudRecordId: 42, status: 'REJECTED', note: '  fout detail  ' });
    expect(rpc).toHaveBeenCalledWith('set_evidence_review', {
      p_evidence_id: 42,
      p_status: 'REJECTED',
      p_note: 'fout detail',
    });
  });

  it('stuurt p_note null wanneer er geen toelichting is', async () => {
    await setEvidenceReview({ cloudRecordId: 7, status: 'APPROVED' });
    expect(rpc).toHaveBeenCalledWith('set_evidence_review', {
      p_evidence_id: 7,
      p_status: 'APPROVED',
      p_note: null,
    });
  });

  it('vertaalt een RPC-fout naar een Error met de fouttekst', async () => {
    rpc.mockResolvedValue({ error: { message: 'rij ontbreekt' } });
    await expect(
      setEvidenceReview({ cloudRecordId: 3, status: 'FINALIZED' }),
    ).rejects.toThrow('rij ontbreekt');
  });

  it('gebruikt een fallback-melding bij een fout zonder message', async () => {
    rpc.mockResolvedValue({ error: {} });
    await expect(
      setEvidenceReview({ cloudRecordId: 3, status: 'FINALIZED' }),
    ).rejects.toThrow('Review bijwerken mislukt');
  });
});

describe('status-wrappers', () => {
  it('approveEvidence zet status APPROVED', async () => {
    await approveEvidence(10, 'prima');
    expect(rpc).toHaveBeenCalledWith(
      'set_evidence_review',
      expect.objectContaining({ p_evidence_id: 10, p_status: 'APPROVED', p_note: 'prima' }),
    );
  });

  it('rejectEvidence zet status REJECTED met toelichting', async () => {
    await rejectEvidence(11, 'onscherp');
    expect(rpc).toHaveBeenCalledWith(
      'set_evidence_review',
      expect.objectContaining({ p_evidence_id: 11, p_status: 'REJECTED', p_note: 'onscherp' }),
    );
  });

  it('finalizeEvidence zet status FINALIZED zonder note', async () => {
    await finalizeEvidence(12);
    expect(rpc).toHaveBeenCalledWith(
      'set_evidence_review',
      expect.objectContaining({ p_evidence_id: 12, p_status: 'FINALIZED', p_note: null }),
    );
  });

  it('reopenEvidence zet status PENDING_REVIEW', async () => {
    await reopenEvidence(13);
    expect(rpc).toHaveBeenCalledWith(
      'set_evidence_review',
      expect.objectContaining({ p_evidence_id: 13, p_status: 'PENDING_REVIEW', p_note: null }),
    );
  });
});

describe('reviewBadgeFor', () => {
  it('geeft een eigen badge per bekende status', () => {
    const cases: Array<[ReviewStatus, string]> = [
      ['APPROVED', 'Goedgekeurd'],
      ['REJECTED', 'Afgekeurd'],
      ['FINALIZED', 'Definitief'],
      ['PENDING_REVIEW', 'In review'],
    ];
    for (const [status, label] of cases) {
      const badge = reviewBadgeFor(status);
      expect(badge.label).toBe(label);
      expect(badge.emoji).not.toBe('');
      expect(badge.bg).toMatch(/^rgba\(/);
      expect(badge.fg).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('valt terug op een neutrale badge bij null/undefined/onbekend', () => {
    for (const status of [null, undefined, 'IETS' as unknown as ReviewStatus]) {
      const badge = reviewBadgeFor(status);
      expect(badge.label).toBe('In review');
      expect(badge.emoji).toBe('⏳');
    }
  });
});

describe('isReviewLocked', () => {
  it('is alleen waar voor FINALIZED', () => {
    expect(isReviewLocked('FINALIZED')).toBe(true);
    for (const status of ['APPROVED', 'REJECTED', 'PENDING_REVIEW', null, undefined] as Array<
      ReviewStatus | null | undefined
    >) {
      expect(isReviewLocked(status)).toBe(false);
    }
  });
});
