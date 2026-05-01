const {
  buildKiKEvidencePayload,
  isRetryableKikError,
} = require('../kikService');

describe('kikService', () => {
  describe('buildKiKEvidencePayload', () => {
    it('builds a KiK payload from a complete evidence record', () => {
      const payload = buildKiKEvidencePayload('fallback-project', {
        id: 'evidence-1',
        project_id: 'project-123',
        inspection_point_id: 'wapening-01',
        photo_uri: 'https://cdn.example.com/evidence-1.jpg',
        exif_hash: 'sha256-hash',
        timestamp: '2026-03-14T10:00:00.000Z',
        latitude: 52.1,
        longitude: 4.3,
        ai_status: 'APPROVED',
        field_note: 'Foto van ingestorte wapening',
      });

      expect(payload).toEqual({
        evidenceId: 'evidence-1',
        projectId: 'project-123',
        inspectionPointId: 'wapening-01',
        mediaUrl: 'https://cdn.example.com/evidence-1.jpg',
        timestamp: '2026-03-14T10:00:00.000Z',
        gps: {
          latitude: 52.1,
          longitude: 4.3,
        },
        exifHash: 'sha256-hash',
        aiValidationStatus: 'APPROVED',
        notes: 'Foto van ingestorte wapening',
      });
    });

    it('falls back to media_uri and explicit notes when provided', () => {
      const payload = buildKiKEvidencePayload('fallback-project', {
        id: 'evidence-3',
        inspection_point_id: 'kozijn-01',
        media_uri: 'https://cdn.example.com/evidence-3.jpg',
        exif_hash: 'sha256-other-hash',
        timestamp: '2026-03-14T10:15:00.000Z',
        latitude: 52.2,
        longitude: 4.4,
        notes: 'Controle voor oplevering',
      });

      expect(payload).toEqual({
        evidenceId: 'evidence-3',
        projectId: 'fallback-project',
        inspectionPointId: 'kozijn-01',
        mediaUrl: 'https://cdn.example.com/evidence-3.jpg',
        timestamp: '2026-03-14T10:15:00.000Z',
        gps: {
          latitude: 52.2,
          longitude: 4.4,
        },
        exifHash: 'sha256-other-hash',
        aiValidationStatus: 'PENDING',
        notes: 'Controle voor oplevering',
      });
    });

    it('returns null when mandatory payload fields are missing', () => {
      const payload = buildKiKEvidencePayload('fallback-project', {
        id: 'evidence-2',
        inspection_point_id: 'wapening-02',
        timestamp: '2026-03-14T10:00:00.000Z',
        latitude: 52.1,
        longitude: 4.3,
      });

      expect(payload).toBeNull();
    });
  });

  describe('isRetryableKikError', () => {
    it('treats transient HTTP failures as retryable', () => {
      expect(isRetryableKikError({ response: { status: 503 } })).toBe(true);
    });

    it('treats transient network codes as retryable', () => {
      expect(isRetryableKikError({ code: 'ETIMEDOUT' })).toBe(true);
    });

    it('does not retry functional 4xx errors', () => {
      expect(isRetryableKikError({ response: { status: 422 } })).toBe(false);
    });
  });
});
