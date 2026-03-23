/**
 * Unit-Tests für die GoBackFab-Komponente.
 *
 * Testet, ob der Zurück-Button gerendert wird und beim Klick
 * einen Schritt in der Browser-History zurücknavigiert.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import "@testing-library/jest-dom";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

/* ===================================================================
// ============================== Mocks ==============================
// =================================================================== */

/** Mock: useCustomStyles — gibt ein leeres Objekt zurück */
jest.mock("../../../constants/styles", () => () => ({}));

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

import {GoBackFab} from "../GoBackFab";

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("GoBackFab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rendert den Zurück-Button", () => {
    render(
      <MemoryRouter>
        <GoBackFab />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", {name: "Zurück"})).toBeInTheDocument();
  });

  test("navigiert einen Schritt zurück beim Klick", async () => {
    render(
      <MemoryRouter>
        <GoBackFab />
      </MemoryRouter>
    );

    const backButton = screen.getByRole("button", {name: "Zurück"});
    await userEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
