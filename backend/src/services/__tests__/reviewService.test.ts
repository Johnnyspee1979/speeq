const {
  REVIEW_STATUS_VALUES,
  normalizeReviewStatus,
} = require('../reviewService');

describe('reviewService', () => {
  it('accepts the supported review states', () => {
    expect(REVIEW_STATUS_VALUES).toEqual([
      'APPROVED',
      'NEEDS_REVIEW',
      'REJECTED',
    ]);
    expect(normalizeReviewStatus('approved')).toBe('APPROVED');
    expect(normalizeReviewStatus('needs_review')).toBe('NEEDS_REVIEW');
    expect(normalizeReviewStatus('REJECTED')).toBe('REJECTED');
  });

  it('rejects unsupported states', () => {
    expect(normalizeReviewStatus('FAILED')).toBeNull();
    expect(normalizeReviewStatus('')).toBeNull();
    expect(normalizeReviewStatus(undefined)).toBeNull();
  });
});
