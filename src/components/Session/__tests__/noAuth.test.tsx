// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, act} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {NoAuthPage} from "../noAuth";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock-Navigate-Funktion fuer react-router */
const mockNavigate = jest.fn();

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../authUserContext", () => ({
  useAuthUser: jest.fn(),
}));
import {useAuthUser} from "../authUserContext";
const mockUseAuthUser = useAuthUser as jest.Mock;

jest.mock("../../../constants/styles", () => ({
  __esModule: true,
  default: () => ({container: {}}),
}));

jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      SIGN_IN_HEADER: "test-image.png",
    }),
  },
}));

/* ===================================================================
// ======================== Hilfsfunktionen ===========================
// =================================================================== */

/**
 * Rendert die NoAuthPage-Komponente innerhalb eines MemoryRouters.
 */
function renderNoAuthPage() {
  return render(
    <MemoryRouter>
      <NoAuthPage />
    </MemoryRouter>,
  );
}

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("NoAuthPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockClear();
    mockUseAuthUser.mockReturnValue({uid: "test-user"});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("zeigt den Countdown startend bei 10 an", () => {
    renderNoAuthPage();

    // Der Alert-Titel enthaelt den Countdown-Wert 10
    expect(screen.getByText(/Umleitung in/)).toHaveTextContent("10");
  });

  it("dekrementiert den Timer nach 1 Sekunde", () => {
    renderNoAuthPage();

    // Timer steht initial auf 10
    expect(screen.getByText(/Umleitung in/)).toHaveTextContent("10");

    // 1 Sekunde vorspulen
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Timer sollte jetzt 9 anzeigen
    expect(screen.getByText(/Umleitung in/)).toHaveTextContent("9");
  });

  it("navigiert zu HOME wenn Timer 0 erreicht und authUser vorhanden ist", () => {
    mockUseAuthUser.mockReturnValue({uid: "test-user"});
    renderNoAuthPage();

    // 10 Sekunden vorspulen (Countdown bis 0), Schritt fuer Schritt
    for (let tick = 0; tick < 10; tick++) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    // Zusaetzlich 500ms fuer den Redirect-setTimeout
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  it("navigiert zu SIGN_IN wenn Timer 0 erreicht und authUser null ist", () => {
    mockUseAuthUser.mockReturnValue(null);
    renderNoAuthPage();

    // 10 Sekunden vorspulen (Countdown bis 0), Schritt fuer Schritt
    for (let tick = 0; tick < 10; tick++) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    // Zusaetzlich 500ms fuer den Redirect-setTimeout
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/signin");
  });

  it("navigiert beim manuellen Klick auf den Link zum korrekten Ziel", async () => {
    mockUseAuthUser.mockReturnValue({uid: "test-user"});
    renderNoAuthPage();

    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    const linkButton = screen.getByRole("button", {name: "hier"});

    await user.click(linkButton);

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });
});
