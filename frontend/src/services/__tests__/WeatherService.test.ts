/**
 * Unit-tests voor WeatherService — haalt het weer op via Open-Meteo bij elke
 * foto-registratie. We mocken global.fetch en borgen:
 *   - de mapping van het Open-Meteo `current`-blok naar een WeatherSnapshot
 *     (afronding, windrichtingslabel, WMO-code → NL-omschrijving, samenvatting);
 *   - veilige defaults bij ontbrekende velden / onbekende weather_code;
 *   - null bij een niet-ok response, ontbrekend `current`, of een fetch-fout
 *     (de fotoflow mag nooit breken op het weer);
 *   - de opgebouwde URL met lat/lng op 4 decimalen.
 */

const mockFetch = jest.fn();
(global as any).fetch = (...a: unknown[]) => mockFetch(...a);

import { fetchWeather } from '../WeatherService';

const okResponse = (current: Record<string, unknown>) => ({
  ok: true,
  json: () => Promise.resolve({ current }),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchWeather — succes', () => {
  it('mapt het current-blok naar een WeatherSnapshot met afronding en labels', async () => {
    mockFetch.mockResolvedValue(
      okResponse({
        temperature_2m: 12.4,
        apparent_temperature: 10.6,
        wind_speed_10m: 18.7,
        wind_direction_10m: 315,
        relative_humidity_2m: 81,
        precipitation: 1.26,
        rain: 1.26,
        snowfall: 0,
        weather_code: 61,
      })
    );

    const snap = await fetchWeather(52.07, 4.3);
    expect(snap).not.toBeNull();
    expect(snap!.tempC).toBe(12);
    expect(snap!.apparentTempC).toBe(11);
    expect(snap!.windSpeedKmh).toBe(19);
    expect(snap!.windDirectionLabel).toBe('NW');
    expect(snap!.humidityPct).toBe(81);
    expect(snap!.precipitationMm).toBe(1.3);
    expect(snap!.description).toBe('Lichte regen');
    expect(snap!.label).toBe('12°C · Lichte regen · Wind 19 km/h NW · 81% vocht');
  });

  it('valt terug op veilige defaults en "Onbekend" bij een onbekende code', async () => {
    mockFetch.mockResolvedValue(okResponse({ weather_code: 4242 }));
    const snap = await fetchWeather(0, 0);
    expect(snap!.tempC).toBe(0);
    expect(snap!.windDirectionLabel).toBe('N');
    expect(snap!.description).toBe('Onbekend');
  });

  it('bouwt de URL met lat/lng op 4 decimalen', async () => {
    mockFetch.mockResolvedValue(okResponse({ weather_code: 0 }));
    await fetchWeather(52.0705, 4.3007);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('latitude=52.0705');
    expect(url).toContain('longitude=4.3007');
    expect(url).toContain('wind_speed_unit=kmh');
  });
});

describe('fetchWeather — faalpaden geven null', () => {
  it('null bij een niet-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(fetchWeather(1, 1)).resolves.toBeNull();
  });

  it('null als het current-blok ontbreekt', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await expect(fetchWeather(1, 1)).resolves.toBeNull();
  });

  it('null bij een fetch-fout (timeout/abort)', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchWeather(1, 1)).resolves.toBeNull();
  });
});
