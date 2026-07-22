/**
 * Leichtgewichtige Anbindung an die kostenlose Open-Meteo-API (Geocoding +
 * Wettervorhersage), ohne API-Key. Wird für das «Nächster Anlass»-Widget auf
 * der Startseite verwendet, um optional Wetterdaten für den Veranstaltungsort
 * anzuzeigen.
 *
 * Alle Fehler (Netzwerk, kein Geocoding-Treffer, Datum ausserhalb des
 * Vorhersagezeitraums, unerwartete Antwortstruktur) werden bewusst still
 * abgefangen — es handelt sich um erwartbare, keine echten Fehler, daher
 * kein Sentry-Logging, höchstens `console.debug`.
 */

import {formatLocalDate} from "../../utils/dateUtils";

/**
 * Wettervorhersage für einen einzelnen Tag innerhalb eines Zeitraums.
 *
 * @param date - Datum dieses Vorhersagetages ("YYYY-MM-DD", lokal).
 * @param iconLabel - Emoji-Symbol für den Wetterzustand (aus WMO-Code abgeleitet).
 * @param tempMax - Maximaltemperatur in Grad Celsius.
 * @param tempMin - Minimaltemperatur in Grad Celsius.
 */
export interface WeatherForecastDay {
  date: string;
  iconLabel: string;
  tempMax: number;
  tempMin: number;
}

/**
 * Mapping von WMO-Wettercodes (Open-Meteo `weathercode`) auf ein
 * repräsentatives Emoji. Nicht erschöpfend — unbekannte Codes fallen auf
 * {@link WMO_FALLBACK_ICON} zurück.
 */
const WMO_WEATHER_CODES: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};
const WMO_FALLBACK_ICON = "🌡️";

/**
 * Prüft, ob ein Datum innerhalb des Vorhersagezeitraums von Open-Meteo liegt.
 * Aktuell ca. 16 Tage — bei Änderungen der Open-Meteo-Dokumentation ggf. anpassen.
 *
 * @param date - Zu prüfendes Datum.
 * @param today - Referenzdatum (Default: jetzt).
 * @returns true, wenn das Datum im Vorhersagezeitraum liegt.
 */
export function isWithinForecastRange(
  date: Date,
  today: Date = new Date(),
): boolean {
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / 86_400_000,
  );
  return diffDays >= 0 && diffDays <= 16;
}

/**
 * Geokodiert einen Freitext-Veranstaltungsort über die Open-Meteo
 * Geocoding-API. Gibt bei fehlendem Treffer oder Fehler still `null` zurück.
 *
 * @param location - Freitext-Ortsangabe (z.B. Lagerhausname, Ort).
 * @returns Koordinaten des ersten Treffers, oder null.
 */
async function geocodeLocation(
  location: string,
): Promise<{lat: number; lng: number} | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      location,
    )}&count=1&language=de&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const first = data?.results?.[0];
    if (!first) return null;

    return {lat: first.latitude, lng: first.longitude};
  } catch (error) {
    console.debug("openMeteo: Geocoding fehlgeschlagen", error);
    return null;
  }
}

/**
 * Lädt die Tagesvorhersagen (Wettercode, Min-/Maxtemperatur) für einen
 * bestimmten Ort über einen Datumsbereich. Gibt bei Fehler still ein leeres
 * Array zurück.
 *
 * @param lat - Breitengrad.
 * @param lng - Längengrad.
 * @param startDate - Erster Tag des Zeitraums.
 * @param endDate - Letzter Tag des Zeitraums.
 * @returns Array der Tagesvorhersagen (kann leer sein).
 */
async function fetchForecastRange(
  lat: number,
  lng: number,
  startDate: Date,
  endDate: Date,
): Promise<WeatherForecastDay[]> {
  try {
    const startStr = formatLocalDate(startDate);
    const endStr = formatLocalDate(endDate);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto` +
      `&start_date=${startStr}&end_date=${endStr}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const dates: string[] | undefined = data?.daily?.time;
    const codes: number[] | undefined = data?.daily?.weathercode;
    const tempsMax: number[] | undefined = data?.daily?.temperature_2m_max;
    const tempsMin: number[] | undefined = data?.daily?.temperature_2m_min;
    if (!dates || !codes || !tempsMax || !tempsMin) return [];

    return dates
      .map((date, index) => {
        const code = codes[index];
        const tempMax = tempsMax[index];
        const tempMin = tempsMin[index];
        if (code === undefined || tempMax === undefined || tempMin === undefined) {
          return null;
        }
        return {
          date,
          iconLabel: WMO_WEATHER_CODES[code] ?? WMO_FALLBACK_ICON,
          tempMax,
          tempMin,
        };
      })
      .filter((day): day is WeatherForecastDay => day !== null);
  } catch (error) {
    console.debug("openMeteo: Wettervorhersage fehlgeschlagen", error);
    return [];
  }
}

/**
 * Lädt die Wettervorhersage für einen Anlass-Veranstaltungsort über einen
 * Datumsbereich (z.B. die Dauer einer Lager-Zeitscheibe). Der Bereich wird
 * automatisch auf den Vorhersagezeitraum von Open-Meteo (~16 Tage)
 * eingeschränkt. Gibt still ein leeres Array zurück, wenn der Ort leer ist,
 * der gesamte Zeitraum ausserhalb des Vorhersagezeitraums liegt, kein
 * Geocoding-Treffer gefunden wird oder die Vorhersage aus einem anderen
 * Grund fehlschlägt — niemals ein Error/Throw.
 *
 * @param location - Freitext-Veranstaltungsort des Anlasses.
 * @param startDate - Erster Tag, für den die Vorhersage gelten soll.
 * @param endDate - Letzter Tag, für den die Vorhersage gelten soll.
 * @returns Array der Tagesvorhersagen innerhalb des Vorhersagezeitraums (kann leer sein).
 * @example
 * const weatherDays = await getEventWeatherRange("Kandersteg", start, end);
 */
export async function getEventWeatherRange(
  location: string,
  startDate: Date,
  endDate: Date,
): Promise<WeatherForecastDay[]> {
  if (!location) return [];

  // Zeitraum auf den Vorhersagezeitraum einschränken
  const today = new Date();
  const effectiveStart = startDate < today ? today : startDate;
  if (!isWithinForecastRange(effectiveStart, today)) return [];

  const maxForecastDate = new Date(today);
  maxForecastDate.setDate(maxForecastDate.getDate() + 16);
  const effectiveEnd = endDate > maxForecastDate ? maxForecastDate : endDate;

  const coords = await geocodeLocation(location);
  if (!coords) return [];

  return fetchForecastRange(coords.lat, coords.lng, effectiveStart, effectiveEnd);
}
