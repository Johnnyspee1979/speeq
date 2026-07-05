jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}));
jest.mock('../../config/tenant', () => ({
  getActiveTenantId: jest.fn(() => 'tenant-abc'),
}));

import { pushApprovedEvidenceToKik } from '../kik';

describe('pushApprovedEvidenceToKik', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('sends approved evidence with ai status and combined notes to the backend', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ submitted: 1, failed: 0, retryPending: 0 }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await pushApprovedEvidenceToKik('project-123', [
      {
        id: 42,
        project_id: 'project-123',
        inspection_point_id: 'brand-doorvoering-001',
        photo_uri: 'https://cdn.example.com/photo.jpg',
        media_uri: 'https://cdn.example.com/media.jpg',
        timestamp: '2026-03-14T10:00:00.000Z',
        latitude: 52.1,
        longitude: 4.3,
        exif_hash: 'sha256-hash',
        field_note: 'Doorvoering in schacht',
        ai_status: 'APPROVED',
        ai_notes: 'Brandmanchet zichtbaar',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];

    // KiK zit nu achter requireAuth: de Supabase-JWT + tenant gaan mee.
    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['x-company-id']).toBe('tenant-abc');
    expect(headers['Content-Type']).toBe('application/json');

    const payload = JSON.parse(String(request.body)) as {
      projectId: string;
      evidence: Array<Record<string, unknown>>;
    };

    expect(payload).toEqual({
      projectId: 'project-123',
      evidence: [
        {
          id: '42',
          project_id: 'project-123',
          inspection_point_id: 'brand-doorvoering-001',
          photo_uri: 'https://cdn.example.com/photo.jpg',
          media_uri: 'https://cdn.example.com/media.jpg',
          exif_hash: 'sha256-hash',
          timestamp: '2026-03-14T10:00:00.000Z',
          latitude: 52.1,
          longitude: 4.3,
          ai_status: 'APPROVED',
          field_note: 'Doorvoering in schacht',
          notes: 'Doorvoering in schacht | Brandmanchet zichtbaar',
        },
      ],
    });
  });
});
