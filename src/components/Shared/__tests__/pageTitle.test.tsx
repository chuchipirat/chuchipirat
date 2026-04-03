/**
 * Unit-Tests fuer die PageTitle-Komponente.
 * Prueft Titel-Rendering, Breadcrumbs, Ribbon und document.title.
 */

// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {PageTitle, Ribbon} from "../pageTitle";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock fuer useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({heroContent: {}})),
}));

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die PageTitle-Komponente mit den uebergebenen Props.
 * Wickelt die Komponente in einen MemoryRouter, da Breadcrumbs
 * useNavigate benoetigen.
 *
 * @param props Optionale Teilmenge der PageTitle-Props.
 * @returns Render-Ergebnis von @testing-library/react.
 */
const renderPageTitle = (
  props: Partial<React.ComponentProps<typeof PageTitle>> = {}
) => {
  return render(
    <MemoryRouter>
      <PageTitle {...props} />
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  document.title = "";
});

describe("PageTitle", () => {
  describe("document.title (Fenstertitel)", () => {
    test("Setzt document.title auf windowTitle wenn vorhanden", () => {
      renderPageTitle({windowTitle: "Mein Fenstertitel"});

      expect(document.title).toBe("Mein Fenstertitel");
    });

    test("Setzt document.title auf title wenn kein windowTitle vorhanden ist", () => {
      renderPageTitle({title: "Seitentitel"});

      expect(document.title).toBe("Seitentitel");
    });

    test("Setzt document.title auf smallTitle wenn weder windowTitle noch title vorhanden ist", () => {
      renderPageTitle({smallTitle: "Kleiner Titel"});

      expect(document.title).toBe("Kleiner Titel");
    });

    test("Setzt document.title auf leeren String wenn nichts angegeben ist", () => {
      renderPageTitle();

      expect(document.title).toBe("");
    });
  });

  describe("Titel-Typografie", () => {
    test("Rendert den grossen Titel (h2-Variante)", () => {
      renderPageTitle({title: "Rezepte"});

      const heading = screen.getByText("Rezepte");
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H1");
    });

    test("Rendert den kleinen Titel (h5-Variante)", () => {
      renderPageTitle({smallTitle: "Einstellungen"});

      const heading = screen.getByText("Einstellungen");
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H1");
    });

    test("Rendert den Untertitel", () => {
      renderPageTitle({subTitle: "Alle Rezepte auf einen Blick"});

      const subHeading = screen.getByText("Alle Rezepte auf einen Blick");
      expect(subHeading).toBeInTheDocument();
      expect(subHeading.tagName).toBe("H2");
    });
  });

  describe("Breadcrumbs", () => {
    test("Rendert Breadcrumbs wenn vorhanden", () => {
      const breadcrumbs = [
        {label: "Startseite", route: "/"},
        {label: "Rezepte", route: "/recipes"},
      ];

      renderPageTitle({
        title: "Mein Rezept",
        breadcrumbs,
      });

      expect(screen.getByText("Startseite")).toBeInTheDocument();
      expect(screen.getByText("Rezepte")).toBeInTheDocument();
      // Die aktuelle Seite erscheint sowohl im Breadcrumb als auch als Titel
      const breadcrumbNav = screen.getByLabelText("Breadcrumb");
      expect(breadcrumbNav).toBeInTheDocument();
    });

    test("Rendert keine Breadcrumbs wenn die Liste leer ist", () => {
      renderPageTitle({title: "Rezepte", breadcrumbs: []});

      const breadcrumbNav = screen.queryByLabelText("Breadcrumb");
      expect(breadcrumbNav).not.toBeInTheDocument();
    });

    test("Rendert keine Breadcrumbs wenn nicht uebergeben", () => {
      renderPageTitle({title: "Rezepte"});

      const breadcrumbNav = screen.queryByLabelText("Breadcrumb");
      expect(breadcrumbNav).not.toBeInTheDocument();
    });
  });

  describe("Ribbon", () => {
    test("Rendert das Ribbon wenn vorhanden", () => {
      renderPageTitle({
        title: "Testseite",
        ribbon: {text: "TEST", class: "test-ribbon"},
      });

      expect(screen.getByText("TEST")).toBeInTheDocument();
    });

    test("Rendert kein Ribbon wenn nicht uebergeben", () => {
      renderPageTitle({title: "Produktivseite"});

      expect(screen.queryByText("TEST")).not.toBeInTheDocument();
    });
  });
});

describe("Ribbon (Einzelkomponente)", () => {
  test("Rendert den Text mit der uebergebenen CSS-Klasse", () => {
    const {container} = render(
      <Ribbon text="BETA" cssProperty="ribbon-beta" />
    );

    expect(screen.getByText("BETA")).toBeInTheDocument();
    const ribbonDiv = container.firstChild as HTMLDivElement;
    expect(ribbonDiv).toHaveClass("ribbon-beta");
  });
});
