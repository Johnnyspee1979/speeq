import {
  buildInspectionCameraDeepLink,
  parseInspectionCameraDeepLink,
  parseInspectionRouteFromNotificationData,
} from '../deepLinking';

describe('deepLinking', () => {
  it('bouwt een Wkb camera deep-link met optionele reden', () => {
    expect(
      buildInspectionCameraDeepLink('WKB-WAPENING-001', 'REJECTED_NEEDS_RETAKE')
    ).toBe(
      'wkb-snap-sync://camera/WKB-WAPENING-001?reason=REJECTED_NEEDS_RETAKE'
    );
  });

  it('parsed een custom scheme deep-link naar een inspectiepunt', () => {
    expect(
      parseInspectionCameraDeepLink(
        'wkb-snap-sync://camera/WKB-WAPENING-001?reason=REJECTED'
      )
    ).toEqual({
      inspectionPointId: 'WKB-WAPENING-001',
      reason: 'REJECTED',
      source: 'deep-link',
    });
  });

  it('parsed een notification payload met nested routing data', () => {
    expect(
      parseInspectionRouteFromNotificationData({
        eventType: 'evidence.review.rejected',
        routing: {
          action: 'OPEN_EVIDENCE',
          inspectionPointId: 'kik-wapening-002',
          reason: 'Foto onvoldoende scherp',
          deepLink:
            'wkb-snap-sync://camera/kik-wapening-002?reason=Foto%20onvoldoende%20scherp',
        },
      })
    ).toEqual({
      inspectionPointId: 'kik-wapening-002',
      reason: 'Foto onvoldoende scherp',
      source: 'notification',
    });
  });
});
