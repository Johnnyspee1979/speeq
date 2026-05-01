const {
  buildReviewNotificationPayload,
} = require('../reviewNotificationService');

describe('reviewNotificationService', () => {
  it('builds a webhook and push payload for rejected evidence', () => {
    const payload = buildReviewNotificationPayload({
      evidenceId: 42,
      projectId: '104A',
      inspectionPointId: 'wapening-07',
      reviewStatus: 'REJECTED',
      reviewNotes: 'Foto toont onvoldoende overlap en te weinig detail.',
      reviewerId: 'reviewer-1',
      reviewerRole: 'KWALITEITSBORGER',
      reviewerCompanyName: 'Borging BV',
      evidenceOwnerId: 'worker-9',
      photoUrl: 'https://cdn.example.com/evidence-42.jpg',
      fieldNote: 'Vakman meldt wapening gereed.',
      occurredAt: '2026-03-14T10:15:00.000Z',
    });

    expect(payload).toEqual({
      eventType: 'evidence.review.rejected',
      occurredAt: '2026-03-14T10:15:00.000Z',
      evidence: {
        id: 42,
        projectId: '104A',
        inspectionPointId: 'wapening-07',
        ownerId: 'worker-9',
        photoUrl: 'https://cdn.example.com/evidence-42.jpg',
        fieldNote: 'Vakman meldt wapening gereed.',
      },
      review: {
        status: 'REJECTED',
        notes: 'Foto toont onvoldoende overlap en te weinig detail.',
        reviewerId: 'reviewer-1',
        reviewerRole: 'KWALITEITSBORGER',
        reviewerCompanyName: 'Borging BV',
      },
      routing: {
        action: 'OPEN_EVIDENCE',
        inspectionPointId: 'wapening-07',
        reason: 'Foto toont onvoldoende overlap en te weinig detail.',
        deepLink:
          'wkb-snap-sync://camera/wapening-07?reason=Foto%20toont%20onvoldoende%20overlap%20en%20te%20weinig%20detail.',
      },
    });
  });
});
