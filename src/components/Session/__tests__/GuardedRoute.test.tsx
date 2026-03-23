// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/**
 * Mock fuer AuthorizationGuard — rendert standardmaessig die Kinder durch.
 * Kann in einzelnen Tests ueberschrieben werden.
 */
jest.mock("../authUserContext", () => ({
  AuthorizationGuard: jest.fn(
    ({children}: {children: React.ReactNode}) => <>{children}</>,
  ),
}));

/**
 * Mock fuer EmailVerificationGuard — rendert standardmaessig die Kinder durch.
 */
jest.mock("../emailVerificationGuard", () => ({
  EmailVerificationGuard: jest.fn(
    ({children}: {children: React.ReactNode}) => <>{children}</>,
  ),
}));

/* ===================================================================
// ======================== Import nach Mocks =========================
// =================================================================== */
import {GuardedRoute} from "../GuardedRoute";
import {AuthorizationGuard} from "../authUserContext";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GuardedRoute", () => {
  /**
   * Wenn beide Guards (AuthorizationGuard und EmailVerificationGuard) die
   * Kinder durchlassen, sollen die geschuetzten Inhalte gerendert werden.
   */
  test("Rendert Kinder wenn beide Guards durchlassen", () => {
    const alwaysAllowCondition = () => true;

    render(
      <GuardedRoute condition={alwaysAllowCondition}>
        <div>Geschuetzter Inhalt</div>
      </GuardedRoute>,
    );

    expect(screen.getByText("Geschuetzter Inhalt")).toBeInTheDocument();
  });

  /**
   * Wenn AuthorizationGuard die Kinder blockiert (null zurueckgibt),
   * duerfen die geschuetzten Inhalte nicht sichtbar sein.
   */
  test("Blockiert Kinder wenn AuthorizationGuard blockiert", () => {
    // AuthorizationGuard so ueberschreiben, dass er nichts rendert
    (AuthorizationGuard as jest.Mock).mockImplementation(() => null);

    const alwaysAllowCondition = () => true;

    render(
      <GuardedRoute condition={alwaysAllowCondition}>
        <div>Geschuetzter Inhalt</div>
      </GuardedRoute>,
    );

    expect(
      screen.queryByText("Geschuetzter Inhalt"),
    ).not.toBeInTheDocument();
  });
});
