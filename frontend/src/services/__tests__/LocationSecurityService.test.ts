import {
  calculateDistanceMeters,
  evaluateLocationSecurity,
} from '../LocationSecurityService';

describe('LocationSecurityService', () => {
  it('allows a precise location inside the project radius', () => {
    const result = evaluateLocationSecurity(
      {
        latitude: 52.0907,
        longitude: 5.1214,
        accuracy: 4,
        isMocked: false,
      },
      {
        projectLocation: { latitude: 52.0908, longitude: 5.1215 },
        allowedRadiusMeters: 50,
        maxAccuracyMeters: 25,
      }
    );

    expect(result.allowed).toBe(true);
    expect(result.spoofRisk).toBe('LOW');
  });

  it('blocks mocked locations immediately', () => {
    const result = evaluateLocationSecurity(
      {
        latitude: 52.0907,
        longitude: 5.1214,
        accuracy: 4,
        isMocked: true,
      },
      {
        projectLocation: { latitude: 52.0908, longitude: 5.1215 },
        allowedRadiusMeters: 50,
        maxAccuracyMeters: 25,
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.issues).toContain('mocked-location');
    expect(result.spoofRisk).toBe('HIGH');
  });

  it('flags poor GPS accuracy as unsuitable for evidence capture', () => {
    const result = evaluateLocationSecurity(
      {
        latitude: 52.0907,
        longitude: 5.1214,
        accuracy: 48,
        isMocked: false,
      },
      {
        projectLocation: { latitude: 52.0908, longitude: 5.1215 },
        allowedRadiusMeters: 50,
        maxAccuracyMeters: 25,
      }
    );

    expect(result.allowed).toBe(false);
    expect(result.issues).toContain('poor-accuracy');
  });

  it('calculates real-world distance in meters', () => {
    const distance = calculateDistanceMeters(
      { latitude: 52.0907, longitude: 5.1214 },
      { latitude: 52.0910, longitude: 5.1214 }
    );

    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(40);
  });
});
