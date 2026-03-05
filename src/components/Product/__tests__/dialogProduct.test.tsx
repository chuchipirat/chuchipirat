/**
 * Unit-Tests fuer DialogProduct im EDIT-Modus.
 *
 * Das CREATE-Verfahren nutzt jetzt Supabase (database.products.insertProduct).
 * Die Tests pruefen: Vorausfuellen des Formulars, Validierung,
 * Callback-Verhalten und Checkbox-/Radio-Logik im EDIT-Modus.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import DialogProduct, {ProductDialog} from "../dialogProduct";
import {Allergen, Diet} from "../product.class";
import Department from "../../Department/department.class";
import Unit, {UnitDimension} from "../../Unit/unit.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

/** Mock-DatabaseService mit insertProduct-Stub (nur für CREATE-Pfad nötig) */
const mockInsertProduct = jest.fn();
const mockDatabase = {
  products: {
    insertProduct: mockInsertProduct,
  },
} as any;

/** DepartmentAutocomplete wird durch ein einfaches Input ersetzt */
jest.mock("../../Department/departmentAutocomplete", () => {
  return ({department}: any) => (
    <input
      data-testid="department-autocomplete"
      readOnly
      value={department?.name || ""}
    />
  );
});

/** UnitAutocomplete wird durch ein einfaches Input ersetzt */
jest.mock("../../Unit/unitAutocomplete", () => {
  return ({unitKey}: any) => (
    <input
      data-testid="unit-autocomplete"
      readOnly
      value={unitKey || ""}
    />
  );
});

/* ===================================================================
// ======================== Test-Daten ================================
// =================================================================== */

const mockAuthUser = {
  uid: "user-123",
  authUid: "auth-uuid-123",
  email: "admin@chuchipirat.ch",
  roles: ["admin"],
} as AuthUser;

const mockDepartment: Department = Object.assign(new Department(), {
  uid: "dept-1",
  name: "Gemüse",
  pos: 1,
  usable: true,
});

const mockUnit: Unit = {
  uid: "unit-1",
  key: "kg",
  name: "Kilogramm",
  dimension: UnitDimension.mass,
} as Unit;

const mockProducts = [
  {
    uid: "prod-1",
    name: "Tomaten",
    department: {uid: "dept-1", name: "Gemüse"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: Diet.Vegan},
    usable: true,
  },
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

interface RenderDialogOptions {
  dialogOpen?: boolean;
  productName?: string;
  productUid?: string;
  allergens?: Allergen[];
  diet?: Diet;
  usable?: boolean;
  selectedDepartment?: Department;
  handleOk?: jest.Mock;
  handleClose?: jest.Mock;
}

/**
 * Rendert den DialogProduct im EDIT-Modus mit konfigurierbaren Props.
 *
 * @param options - Optionale Konfiguration der Dialog-Props
 * @returns Objekt mit den Mock-Callbacks
 */
const renderEditDialog = (options: RenderDialogOptions = {}) => {
  const {
    dialogOpen = true,
    productName = "Tomaten",
    productUid = "prod-1",
    allergens = [],
    diet = Diet.Vegan,
    usable = true,
    selectedDepartment = mockDepartment,
    handleOk = jest.fn(),
    handleClose = jest.fn(),
  } = options;

  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <DialogProduct
        dialogType={ProductDialog.EDIT}
        productName={productName}
        productUid={productUid}
        productDietProperties={{allergens, diet}}
        productUsable={usable}
        products={mockProducts as any}
        dialogOpen={dialogOpen}
        handleOk={handleOk}
        handleClose={handleClose}
        handleChooseExisting={jest.fn()}
        selectedDepartment={selectedDepartment}
        selectedUnit={mockUnit}
        usable={usable}
        departments={[mockDepartment]}
        units={[mockUnit]}
        authUser={mockAuthUser}
      />
    </DatabaseContext.Provider>,
  );

  return {handleOk, handleClose};
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("DialogProduct — EDIT", () => {
  test("Wird mit vorausgefuellten Werten geöffnet", async () => {
    renderEditDialog();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Tomaten")).toBeInTheDocument();
    });
    expect(screen.getByTestId("department-autocomplete")).toHaveValue("Gemüse");
    expect(screen.getByTestId("unit-autocomplete")).toHaveValue("kg");
  });

  test("OK gibt das geaenderte Produkt zurueck", async () => {
    const handleOk = jest.fn();
    renderEditDialog({handleOk});

    // Name ändern
    const nameInput = await waitFor(() => screen.getByDisplayValue("Tomaten"));
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Kartoffeln");

    // OK klicken
    await userEvent.click(screen.getByRole("button", {name: /^ok$/i}));

    expect(handleOk).toHaveBeenCalledTimes(1);
    const calledWith = handleOk.mock.calls[0][0];
    expect(calledWith.name).toBe("Kartoffeln");
    expect(calledWith.uid).toBe("prod-1");
  });

  test("Name-Validierung: leerer Name zeigt Fehlermeldung", async () => {
    renderEditDialog();

    const nameInput = await waitFor(() => screen.getByDisplayValue("Tomaten"));
    await userEvent.clear(nameInput);

    await userEvent.click(screen.getByRole("button", {name: /^ok$/i}));

    // Fehlermeldung sollte erscheinen
    expect(
      screen.getByText(/produkt angeben|bitte.*produkt/i),
    ).toBeInTheDocument();
  });

  test("Abteilungs-Validierung: fehlende Abteilung verhindert Callback", async () => {
    // Leeres Objekt ohne 'name'-Property → Validierung schlägt fehl.
    // Das Dialog-Formular zeigt keinen sichtbaren Abteilungsfehler, aber
    // der OK-Callback wird nicht ausgeführt.
    const handleOk = jest.fn();
    renderEditDialog({selectedDepartment: {} as Department, handleOk});

    await waitFor(() => screen.getByDisplayValue("Tomaten"));

    await userEvent.click(screen.getByRole("button", {name: /^ok$/i}));

    expect(handleOk).not.toHaveBeenCalled();
  });

  test("Abbrechen schliesst den Dialog ohne Callback", async () => {
    const handleOk = jest.fn();
    const handleClose = jest.fn();
    renderEditDialog({handleOk, handleClose});

    await waitFor(() => screen.getByDisplayValue("Tomaten"));

    await userEvent.click(
      screen.getByRole("button", {name: /abbrechen/i}),
    );

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleOk).not.toHaveBeenCalled();
  });

  test("Lactose-Checkbox setzt allergens korrekt", async () => {
    // Ohne Laktose starten
    renderEditDialog({allergens: []});

    await waitFor(() => screen.getByDisplayValue("Tomaten"));

    // Laktose-Checkbox sollte nicht angehakt sein
    const lactoseCheckbox = screen.getByRole("checkbox", {
      name: /laktose|lactose/i,
    });
    expect(lactoseCheckbox).not.toBeChecked();

    // Laktose anklicken
    await userEvent.click(lactoseCheckbox);

    expect(lactoseCheckbox).toBeChecked();
  });

  test("Diaet-Radio aendert diet-Wert", async () => {
    // Mit Fleisch-Diät starten
    renderEditDialog({diet: Diet.Meat});

    await waitFor(() => screen.getByDisplayValue("Tomaten"));

    // Vegan-Radio auswählen
    const veganRadio = screen.getByRole("radio", {name: /vegan/i});
    await userEvent.click(veganRadio);

    expect(veganRadio).toBeChecked();
  });
});
