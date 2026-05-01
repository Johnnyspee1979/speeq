import type { Request } from 'express';

const { backendConfig } = require('../../config');
const {
  parseAuthorizationHeader,
  parseExactBookHoursRequest,
  resolveExactCredentials,
} = require('../exactHoursRoute');

const createRequest = (
  overrides: Partial<Request> & {
    headers?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  } = {}
) =>
  ({
    headers: {},
    query: {},
    body: {},
    ...overrides,
  }) as Request;

describe('exactHoursRoute', () => {
  const originalDivisionId = backendConfig.exactDivisionId;

  afterEach(() => {
    backendConfig.exactDivisionId = originalDivisionId;
  });

  it('extracts bearer tokens from the authorization header', () => {
    expect(parseAuthorizationHeader('Bearer token-abc')).toBe('token-abc');
    expect(parseAuthorizationHeader('token-raw')).toBe('token-raw');
  });

  it('falls back to EXACT_DIVISION_ID when the request omits divisionId', () => {
    backendConfig.exactDivisionId = '900001';

    expect(
      resolveExactCredentials(
        createRequest({
          headers: {
            authorization: 'Bearer token-xyz',
          },
        })
      )
    ).toEqual({
      divisionId: '900001',
      accessToken: 'token-xyz',
    });
  });

  it('parses a valid hours booking payload from mixed headers and body fields', () => {
    backendConfig.exactDivisionId = '';

    expect(
      parseExactBookHoursRequest(
        createRequest({
          headers: {
            'x-exact-division-id': '123456',
            authorization: 'Bearer token-abc',
          },
          body: {
            projectId: 'PRJ-42',
            employeeId: 'EMP-7',
            hours: '2.5',
            notes: 'Herstel wapening',
          },
        })
      )
    ).toEqual({
      ok: true,
      divisionId: '123456',
      accessToken: 'token-abc',
      transaction: {
        projectId: 'PRJ-42',
        employeeId: 'EMP-7',
        hours: 2.5,
        notes: 'Herstel wapening',
      },
    });
  });

  it('returns a clear validation error when the token is missing', () => {
    backendConfig.exactDivisionId = '123456';

    expect(
      parseExactBookHoursRequest(
        createRequest({
          body: {
            projectId: 'PRJ-42',
            hours: 1,
          },
        })
      )
    ).toEqual({
      ok: false,
      status: 400,
      error:
        'Exact access token ontbreekt. Lever accessToken aan of gebruik een Authorization header.',
    });
  });
});
