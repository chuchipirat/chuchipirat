import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";

import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: Sentry — wird fuer die Fehlerbehandlung verwendet */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

const mockGetSettings = jest.fn();
const mockDatabase = {
  globalSettings: {
    getSettings: mockGetSettings,
  },
} as unknown as DatabaseService;

import {
  GlobalSettingsProvider,
  GlobalSettingsContext,
  useGlobalSettings,
} from "../globalSettingsContext";

/**
 * Hilfskomponente zum Testen von useGlobalSettings.
 */
const SettingsConsumer: React.FC = () => {
  const {maintenanceMode} = useGlobalSettings();
  return <div data-testid="maintenance-mode">{String(maintenanceMode)}</div>;
};

const renderProvider = () => {
  return render(
    <DatabaseContext.Provider value={mockDatabase}>
      <GlobalSettingsProvider>
        <SettingsConsumer />
      </GlobalSettingsProvider>
    </DatabaseContext.Provider>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({advanceTimers: true});
});

afterEach(() => {
  jest.useRealTimers();
});

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("useGlobalSettings", () => {
  test("Gibt maintenanceMode: false zurueck, wenn ausserhalb eines Providers verwendet (fail-open Default)", () => {
    render(<SettingsConsumer />);

    expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("false");
  });

  test("Gibt den bereitgestellten Wert aus dem Context zurueck", () => {
    render(
      <GlobalSettingsContext.Provider value={{maintenanceMode: true}}>
        <SettingsConsumer />
      </GlobalSettingsContext.Provider>,
    );

    expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("true");
  });
});

describe("GlobalSettingsProvider", () => {
  test("Laedt maintenanceMode beim Start und aktualisiert den Context", async () => {
    mockGetSettings.mockResolvedValue({allowSignUp: true, maintenanceMode: true});

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("true");
    });
  });

  test("Startet mit maintenanceMode: false, bis der erste Read abgeschlossen ist (fail-open)", async () => {
    let resolveSettings!: (value: {allowSignUp: boolean; maintenanceMode: boolean}) => void;
    mockGetSettings.mockReturnValue(
      new Promise((resolve) => {
        resolveSettings = resolve;
      }),
    );

    renderProvider();

    expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("false");

    resolveSettings({allowSignUp: true, maintenanceMode: true});
    await waitFor(() => {
      expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("true");
    });
  });

  test("Behaelt den zuletzt bekannten Wert, wenn ein Poll fehlschlaegt (kein Reset auf false)", async () => {
    mockGetSettings
      .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true})
      .mockRejectedValueOnce(new Error("network error"));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("true");
    });

    // Naechsten Poll (60s) ausloesen — dieser schlaegt fehl
    jest.advanceTimersByTime(60_000);

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
    });

    // Wert bleibt weiterhin "true", trotz fehlgeschlagenem Poll
    expect(screen.getByTestId("maintenance-mode")).toHaveTextContent("true");
  });

  test("Fragt die Einstellungen periodisch erneut ab", async () => {
    mockGetSettings.mockResolvedValue({allowSignUp: true, maintenanceMode: false});

    renderProvider();

    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
    });

    jest.advanceTimersByTime(60_000);
    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
    });

    jest.advanceTimersByTime(60_000);
    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalledTimes(3);
    });
  });
});
