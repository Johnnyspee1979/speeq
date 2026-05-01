const {
  createExactClient,
  isRetryableExactError,
} = require('../exactOnlineService');

describe('exactOnlineService', () => {
  it('creates a tenant-aware client for the requested division', () => {
    const client = createExactClient('123456', 'token-abc');

    expect(client.defaults.baseURL).toBe(
      'https://start.exactonline.nl/api/v1/123456'
    );
    expect(client.defaults.headers.Authorization).toBe('Bearer token-abc');
  });

  it('marks transient Exact outages as retryable', () => {
    expect(isRetryableExactError({ response: { status: 429 } })).toBe(true);
    expect(isRetryableExactError({ code: 'ECONNRESET' })).toBe(true);
  });

  it('does not retry validation failures', () => {
    expect(isRetryableExactError({ response: { status: 400 } })).toBe(false);
  });
});
