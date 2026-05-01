const {
  buildBcfTopicPayload,
  mapEvidenceStatusToBcfTopicStatus,
} = require('../bcfService');

describe('bcfService', () => {
  it('maps approved evidence to a closed BCF topic', () => {
    expect(mapEvidenceStatusToBcfTopicStatus('APPROVED')).toBe('Closed');
    expect(mapEvidenceStatusToBcfTopicStatus('PASSED')).toBe('Closed');
    expect(mapEvidenceStatusToBcfTopicStatus('REJECTED')).toBe('Open');
  });

  it('builds a BCF topic payload for a BIM-linked evidence item', () => {
    expect(
      buildBcfTopicPayload({
        projectId: '104A',
        evidenceId: 'evidence-11',
        ifcGuid: '3f6d4e9a-1a5b-4c8f-8d6a-2c7c9b1f1010',
        title: 'Wkb Inspectie: wapening-001',
        description: 'AI Status: PASSED.',
        mediaUrl: 'https://cdn.example.com/evidence-11.jpg',
        status: 'Closed',
      })
    ).toEqual({
      topic_type: 'Wkb Inspection',
      topic_status: 'Closed',
      title: 'Wkb Inspectie: wapening-001',
      description:
        'AI Status: PASSED.\n\nBekijk Wkb-bewijs: https://cdn.example.com/evidence-11.jpg',
      creation_author: 'Wkb Snap & Sync App',
      bim_snippet: {
        reference: 'https://cdn.example.com/evidence-11.jpg',
        reference_schema: 'URL',
        snippet_type: 'WkbEvidence',
        is_external: true,
      },
      viewpoint: {
        components: {
          selection: [
            {
              ifc_guid: '3f6d4e9a-1a5b-4c8f-8d6a-2c7c9b1f1010',
            },
          ],
        },
      },
    });
  });
});
