const generateConsumentendossierMock = jest.fn();
const getConsumerDossierStatusMock = jest.fn();

class IncompleteConsumerDossierErrorMock extends Error {
  statusCode: number;
  issues: Array<{ id: string; detail: string }>;

  constructor(issues: Array<{ id: string; detail: string }>) {
    super('Consumentendossier is nog niet compleet genoeg voor export.');
    this.statusCode = 409;
    this.issues = issues;
  }
}

jest.mock('../dossierGenerator', () => ({
  generateConsumentendossier: (...args: unknown[]) =>
    generateConsumentendossierMock(...args),
}));

jest.mock('../consumerDossierContext', () => ({
  getConsumerDossierStatus: (...args: unknown[]) =>
    getConsumerDossierStatusMock(...args),
  IncompleteConsumerDossierError: IncompleteConsumerDossierErrorMock,
}));
const { generateConsumerDossier } = require('../consumerDossierGenerator');

describe('consumerDossierGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws a 409-style dossier error when the server-side status is not ready', async () => {
    getConsumerDossierStatusMock.mockResolvedValue({
      ready: false,
      issues: [{ id: 'consumer-documentation-missing', detail: '6/7 documentonderdelen compleet.' }],
    });

    await expect(generateConsumerDossier('104A')).rejects.toMatchObject({
      statusCode: 409,
      issues: [{ id: 'consumer-documentation-missing' }],
    });
    expect(generateConsumentendossierMock).not.toHaveBeenCalled();
  });

  it('delegates to the PDF generator when the dossier status is ready', async () => {
    const expectedBuffer = Buffer.from('pdf');

    getConsumerDossierStatusMock.mockResolvedValue({
      ready: true,
      issues: [],
    });
    generateConsumentendossierMock.mockResolvedValue(expectedBuffer);

    const result = await generateConsumerDossier('104A');

    expect(result).toBe(expectedBuffer);
    expect(generateConsumentendossierMock).toHaveBeenCalledWith('104A');
  });
});
