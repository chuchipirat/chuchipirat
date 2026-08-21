/**
 * Unit-Tests fuer die Open-Meteo-Anbindung (Geocoding + Wettervorhersage).
 *
 * Testet, dass jeglicher Fehlschlag (kein Treffer, HTTP-Fehler, Netzwerkfehler,
 * Datum ausserhalb des Vorhersagezeitraums) still zu null fuehrt, nie zu
 * einem Throw.
 */
import {getEventWeatherRange, isWithinForecastRange} from "../openMeteo";

function mockFetchResponses(responses: Array<{ok: boolean; json?: unknown}>) {
  let callIndex = 0;
  window.fetch = jest.fn().mockImplementation(() => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex += 1;
    return Promise.resolve({
      ok: response.ok,
      json: () => Promise.resolve(response.json),
    });
  }) as jest.Mock;
}

describe("isWithinForecastRange", () => {
  test("gibt true zurueck fuer heute", () => {
    const today = new Date("2026-03-01");
    expect(isWithinForecastRange(today, today)).toBe(true);
  });

  test("gibt true zurueck fuer ein Datum innerhalb von 16 Tagen", () => {
    const today = new Date("2026-03-01");
    const date = new Date("2026-03-15");
    expect(isWithinForecastRange(date, today)).toBe(true);
  });

  test("gibt false zurueck fuer ein Datum ausserhalb von 16 Tagen", () => {
    const today = new Date("2026-03-01");
    const date = new Date("2026-03-25");
    expect(isWithinForecastRange(date, today)).toBe(false);
  });

  test("gibt false zurueck fuer ein Datum in der Vergangenheit", () => {
    const today = new Date("2026-03-15");
    const date = new Date("2026-03-01");
    expect(isWithinForecastRange(date, today)).toBe(false);
  });
});

describe("getEventWeatherRange", () => {
  const nearFutureRange = () => {
    const start = new Date();
    start.setDate(start.getDate() + 3);
    const end = new Date();
    end.setDate(end.getDate() + 5);
    return {start, end};
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("gibt ein leeres Array zurueck bei leerem Ort", async () => {
    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("", start, end);
    expect(result).toEqual([]);
  });

  test("gibt ein leeres Array zurueck, wenn der gesamte Zeitraum ausserhalb des Vorhersagezeitraums liegt", async () => {
    const farFutureStart = new Date();
    farFutureStart.setDate(farFutureStart.getDate() + 30);
    const farFutureEnd = new Date();
    farFutureEnd.setDate(farFutureEnd.getDate() + 32);

    const result = await getEventWeatherRange(
      "Kandersteg",
      farFutureStart,
      farFutureEnd,
    );
    expect(result).toEqual([]);
  });

  test("gibt ein leeres Array zurueck bei leerem Geocoding-Ergebnis", async () => {
    mockFetchResponses([{ok: true, json: {results: []}}]);

    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("UnbekannterOrt", start, end);
    expect(result).toEqual([]);
  });

  test("gibt ein leeres Array zurueck bei nicht-ok Geocoding-Antwort", async () => {
    mockFetchResponses([{ok: false}]);

    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("Kandersteg", start, end);
    expect(result).toEqual([]);
  });

  test("gibt ein leeres Array zurueck bei nicht-ok Forecast-Antwort", async () => {
    mockFetchResponses([
      {ok: true, json: {results: [{latitude: 46.5, longitude: 7.6}]}},
      {ok: false},
    ]);

    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("Kandersteg", start, end);
    expect(result).toEqual([]);
  });

  test("gibt ein leeres Array zurueck und wirft nicht bei Netzwerkfehler", async () => {
    window.fetch = jest.fn().mockRejectedValue(new Error("Netzwerkfehler"));

    const {start, end} = nearFutureRange();
    await expect(
      getEventWeatherRange("Kandersteg", start, end),
    ).resolves.toEqual([]);
  });

  test("gibt die Tagesvorhersagen bei Erfolg zurueck", async () => {
    mockFetchResponses([
      {ok: true, json: {results: [{latitude: 46.5, longitude: 7.6}]}},
      {
        ok: true,
        json: {
          daily: {
            time: ["2026-08-01", "2026-08-02"],
            weathercode: [1, 61],
            temperature_2m_max: [18.4, 15.1],
            temperature_2m_min: [7.2, 6.5],
          },
        },
      },
    ]);

    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("Kandersteg", start, end);

    expect(result).toEqual([
      {date: "2026-08-01", iconLabel: "🌤️", tempMax: 18.4, tempMin: 7.2},
      {date: "2026-08-02", iconLabel: "🌧️", tempMax: 15.1, tempMin: 6.5},
    ]);
  });

  test("faellt auf das Fallback-Icon zurueck bei unbekanntem Wettercode", async () => {
    mockFetchResponses([
      {ok: true, json: {results: [{latitude: 46.5, longitude: 7.6}]}},
      {
        ok: true,
        json: {
          daily: {
            time: ["2026-08-01"],
            weathercode: [999],
            temperature_2m_max: [10],
            temperature_2m_min: [2],
          },
        },
      },
    ]);

    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("Kandersteg", start, end);

    expect(result).toEqual([
      {date: "2026-08-01", iconLabel: "🌡️", tempMax: 10, tempMin: 2},
    ]);
  });

  test("gibt ein leeres Array zurueck bei unvollstaendiger Forecast-Antwort", async () => {
    mockFetchResponses([
      {ok: true, json: {results: [{latitude: 46.5, longitude: 7.6}]}},
      {ok: true, json: {daily: {}}},
    ]);

    const {start, end} = nearFutureRange();
    const result = await getEventWeatherRange("Kandersteg", start, end);
    expect(result).toEqual([]);
  });
});
