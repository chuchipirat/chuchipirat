/**
 * Unit-Tests fuer ProductsPage.
 *
 * Testet die Produkte-Seite: initiales Laden, Anzeige der Produkte,
 * Bearbeitungsmodus, selektives Speichern und Fehlerbehandlung.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {ProductsPage} from "../products";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen Benutzer mit communityLeader- und Admin-Rolle zurueck */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "admin@chuchipirat.ch",
  roles: ["communityLeader", "admin"],
};
jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: useCustomDialog — simuliert den Bestaetigungsdialog */
const mockCustomDialog = jest.fn();
jest.mock("../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

/** Mock: useFirebase — gibt ein leeres Objekt zurueck (Firebase wird noch fuer Feed + Material benoetigt) */
jest.mock("../../Firebase/firebaseContext", () => ({
  useFirebase: () => ({}),
}));

/** Mock: @mui/x-data-grid — DataGrid rendert nicht korrekt in jsdom */
jest.mock("@mui/x-data-grid", () => ({
  DataGrid: ({rows, columns}: any) => (
    <div data-testid="mock-data-grid">
      {rows?.map((row: any) => (
        <div key={row.uid} data-testid={`row-${row.uid}`}>
          {row.name}
        </div>
      ))}
    </div>
  ),
  gridClasses: {
    main: "main",
    columnHeaders: "columnHeaders",
    virtualScroller: "virtualScroller",
  },
}));
jest.mock("@mui/x-data-grid/locales", () => ({
  deDE: {components: {MuiDataGrid: {defaultProps: {localeText: {}}}}},
}));

/** Mock: ProductRepository-Methoden */
const mockGetAllProducts = jest.fn();
const mockUpdateProduct = jest.fn();
const mockGetAllDepartments = jest.fn();
const mockGetAllUnits = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  products: {
    getAllProducts: mockGetAllProducts,
    updateProduct: mockUpdateProduct,
  },
  departments: {
    getAllDepartments: mockGetAllDepartments,
  },
  units: {
    getAllUnits: mockGetAllUnits,
  },
} as any;

/** Testdaten: Produkte */
const mockProducts = [
  {
    uid: "prod-1",
    name: "Tomaten",
    department: {uid: "dept-1", name: "Gemuese"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: 3},
    usable: true,
  },
  {
    uid: "prod-2",
    name: "Milch",
    department: {uid: "dept-2", name: "Milchprodukte"},
    shoppingUnit: "l",
    dietProperties: {allergens: [1], diet: 2},
    usable: true,
  },
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die ProductsPage mit allen noetigen Providern.
 */
const renderProductsPage = () => {
  return render(
    <MemoryRouter initialEntries={["/products"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <ProductsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllProducts.mockResolvedValue(mockProducts);
  mockUpdateProduct.mockResolvedValue(mockProducts[0]);
  mockGetAllDepartments.mockResolvedValue([
    {uid: "dept-1", name: "Gemuese"},
    {uid: "dept-2", name: "Milchprodukte"},
  ]);
  mockGetAllUnits.mockResolvedValue([
    {uid: "unit-1", key: "kg", name: "Kilogramm", dimension: 1},
    {uid: "unit-2", key: "l", name: "Liter", dimension: 2},
  ]);
});

describe("ProductsPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderProductsPage();

      await waitFor(() => {
        expect(screen.getByText("Produkte")).toBeInTheDocument();
      });
    });

    test("getAllProducts() wird beim Laden aufgerufen", async () => {
      renderProductsPage();

      await waitFor(() => {
        expect(mockGetAllProducts).toHaveBeenCalledWith({
          onlyUsable: false,
          withDepartmentName: true,
        });
      });
    });

    test("Produkte werden angezeigt", async () => {
      renderProductsPage();

      await waitFor(() => {
        expect(screen.getByText("Tomaten")).toBeInTheDocument();
        expect(screen.getByText("Milch")).toBeInTheDocument();
      });
    });

    test("Fehler beim Laden wird als Alert angezeigt", async () => {
      mockGetAllProducts.mockRejectedValue(new Error("DB Fehler"));
      renderProductsPage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    test("'anpassen'-Button wird angezeigt", async () => {
      renderProductsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anpassen/i}),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Speichern", () => {
    test("Speichern ohne Änderungen schreibt nichts in die DB", async () => {
      renderProductsPage();

      // Warten bis Produkte geladen sind
      await waitFor(() => expect(mockGetAllProducts).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren
      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));
      await waitFor(() =>
        expect(
          screen.getByRole("button", {name: /Speichern/i}),
        ).toBeInTheDocument(),
      );

      // Speichern ohne eine Änderung vorzunehmen
      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      expect(mockUpdateProduct).not.toHaveBeenCalled();
    });
  });
});
