/**
 * WeatherService — haalt automatisch het weer op via Open-Meteo (gratis, geen API-key).
 * Wordt aangeroepen bij elke foto-registratie.
 */

export type WeatherSnapshot = {
  tempC: number;
  apparentTempC: number;
  description: string;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windDirectionLabel: string; // "NW", "ZO", etc.
  humidityPct: number;
  precipitationMm: number;
  rainMm: number;
  snowMm: number;
  label: string; // korte samenvatting
};

// Open-Meteo WMO weather code → Nederlandse omschrijving
const WMO_LABELS: Record<number, string> = {
  0: 'Heldere lucht',
  1: 'Overwegend helder',
  2: 'Gedeeltelijk bewolkt',
  3: 'Bewolkt',
  45: 'Mist',
  48: 'IJsmist',
  51: 'Lichte motregen',
  53: 'Matige motregen',
  55: 'Zware motregen',
  61: 'Lichte regen',
  63: 'Matige regen',
  65: 'Zware regen',
  71: 'Lichte sneeuwval',
  73: 'Matige sneeuwval',
  75: 'Zware sneeuwval',
  80: 'Lichte buien',
  81: 'Matige buien',
  82: 'Zware buien',
  95: 'Onweer',
  96: 'Onweer met hagel',
  99: 'Zwaar onweer met hagel',
};

// Graden → windrichtingslabel (16 richtingen)
function degToCompass(deg: number): string {
  const dirs = ['N', 'NNO', 'NO', 'ONO', 'O', 'OZO', 'ZO', 'ZZO',
                'Z', 'ZZW', 'ZW', 'WZW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx] ?? 'N';
}

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherSnapshot | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}` +
      `&longitude=${longitude.toFixed(4)}` +
      `&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,` +
      `relative_humidity_2m,precipitation,rain,snowfall,weather_code` +
      `&wind_speed_unit=kmh` +
      `&timezone=auto`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;

    const data = await resp.json();
    const c = data?.current;
    if (!c) return null;

    const tempC = Math.round(c.temperature_2m ?? 0);
    const apparentTempC = Math.round(c.apparent_temperature ?? tempC);
    const windSpeedKmh = Math.round(c.wind_speed_10m ?? 0);
    const windDirectionDeg = Math.round(c.wind_direction_10m ?? 0);
    const windDirectionLabel = degToCompass(windDirectionDeg);
    const humidityPct = Math.round(c.relative_humidity_2m ?? 0);
    const precipitationMm = Math.round((c.precipitation ?? 0) * 10) / 10;
    const rainMm = Math.round((c.rain ?? 0) * 10) / 10;
    const snowMm = Math.round((c.snowfall ?? 0) * 10) / 10;
    const code = c.weather_code ?? 0;
    const description = WMO_LABELS[code] ?? 'Onbekend';

    const label = `${tempC}°C · ${description} · Wind ${windSpeedKmh} km/h ${windDirectionLabel} · ${humidityPct}% vocht`;

    return {
      tempC,
      apparentTempC,
      description,
      windSpeedKmh,
      windDirectionDeg,
      windDirectionLabel,
      humidityPct,
      precipitationMm,
      rainMm,
      snowMm,
      label,
    };
  } catch {
    return null;
  }
}
