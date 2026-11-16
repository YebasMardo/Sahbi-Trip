import { Injectable } from '@nestjs/common';

// PLACEHOLDER — no real weather API wired up yet. Deterministic pseudo-random
// forecast seeded by city+date so the same day always renders the same
// weather (no flicker between requests). Swap the body for a real forecast
// API call later; the (city, date) -> { tempC, label } contract can stay.
const WEATHER_LABELS = ['Ensoleillé', 'Voilé', 'Nuageux', 'Ensoleillé', 'Ensoleillé'];

@Injectable()
export class WeatherStubService {
  forecast(city: string, date: string): { tempC: number; label: string } {
    const seed = hashString(`${city}|${date}`);
    const tempC = 18 + (seed % 15); // 18-32°C
    const label = WEATHER_LABELS[seed % WEATHER_LABELS.length];
    return { tempC, label };
  }
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}
