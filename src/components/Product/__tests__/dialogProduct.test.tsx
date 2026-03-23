/**
 * Unit-Tests fuer DialogProduct im EDIT- und CREATE-Modus.
 *
 * Das CREATE-Verfahren nutzt Supabase (database.products.insertProduct).
 * Die Tests pruefen: Vorausfuellen des Formulars, Validierung,
 * Callback-Verhalten, Checkbox-/Radio-Logik und aehnliche-Produkte-Dialog.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogProduct, ProductDialog} from "../dialogProduct";
import {Allergen, Diet} from "../product.types";
import Department from "../../Department/department.class";
import {Unit, UnitDimension} from "../../Unit/unit.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

/** Sentry-Mock */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/** Mock-DatabaseService mit insertProduct- und insertFeed-Stub */
const mockInsertProduct = jest.fn();
const mockInsertFeed = jest.fn().mockResolvedValue({});
const mockDatabase = {
  products: {
    insertProduct: mockInsertProduct,
  },
  feeds: {
    insertFeed: mockInsertFeed,
  },
} as any;

/** DepartmentAutocomplete wird durch ein einfaches Input ersetzt */
jest.mock("../../Department/departmentAutocomplete", () => ({
  DepartmentAutocomplete: ({department}: any) => (
    <input
      data-testid="department-autocomplete"
      readOnly
      value={department?.name || ""}
    />
  ),
}));

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
  uid: "auth-uuid-123",
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

/* ===================================================================
// ======================== CREATE-Modus Tests ========================
// =================================================================== */

/**
 * Rendert den DialogProduct im CREATE-Modus.
 */
const renderCreateDialog = (options: Partial<RenderDialogOptions> = {}) => {
  const {
    dialogOpen = true,
    productName = "Avocado",
    handleOk = jest.fn(),
    handleClose = jest.fn(),
  } = options;

  const handleChooseExisting = jest.fn();

  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <DialogProduct
        dialogType={ProductDialog.CREATE}
        productName={productName}
        productUid=""
        productDietProperties={{allergens: [], diet: Diet.Meat}}
        products={mockProducts as any}
        dialogOpen={dialogOpen}
        handleOk={handleOk}
        handleClose={handleClose}
        handleChooseExisting={handleChooseExisting}
        selectedDepartment={mockDepartment}
        selectedUnit={mockUnit}
        usable={true}
        departments={[mockDepartment]}
        units={[mockUnit]}
        authUser={mockAuthUser}
      />
    </DatabaseContext.Provider>,
  );

  return {handleOk, handleClose, handleChooseExisting};
};

describe("DialogProduct — CREATE", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("insertProduct wird mit korrekten Argumenten aufgerufen", async () => {
    const insertedProduct = {
      uid: "new-uid-1",
      name: "Avocado",
      nameSingular: "Avocado",
      department: {uid: "dept-1", name: "Gemüse"},
      shoppingUnit: "kg",
      dietProperties: {allergens: [], diet: Diet.Meat},
      usable: true,
    };
    mockInsertProduct.mockResolvedValue(insertedProduct);

    const handleOk = jest.fn();
    renderCreateDialog({handleOk});

    await waitFor(() => screen.getByDisplayValue("Avocado"));

    // Erstellen-Button klicken
    await userEvent.click(
      screen.getByRole("button", {name: /erstellen/i}),
    );

    expect(mockInsertProduct).toHaveBeenCalledTimes(1);
    const callArgs = mockInsertProduct.mock.calls[0][0];
    expect(callArgs.name).toBe("Avocado");
    expect(callArgs.usable).toBe(true);

    // handleOk wird asynchron nach insertProduct aufgerufen
    await waitFor(() => {
      expect(handleOk).toHaveBeenCalledTimes(1);
    });
    expect(handleOk.mock.calls[0][0].uid).toBe("new-uid-1");
    expect(handleOk.mock.calls[0][0].name).toBe("Avocado");
  });

  test("Aehnliche-Produkte-Dialog erscheint bei aehnlichem Namen", async () => {
    // "Tomaten" ist identisch zum bestehenden Produkt in mockProducts
    renderCreateDialog({productName: "Tomaten"});

    // Der Dialog fuer aehnliche Produkte sollte sichtbar werden (Titel)
    await waitFor(() => {
      expect(screen.getByRole("heading", {name: /ähnliche produkte/i})).toBeInTheDocument();
    });
  });

  test("Bestehendes Produkt waehlen ruft handleChooseExisting auf", async () => {
    // "Tomaten" ist identisch zum bestehenden Produkt
    const {handleChooseExisting} = renderCreateDialog({productName: "Tomaten"});

    // Warten auf den aehnliche-Produkte-Dialog
    await waitFor(() => {
      expect(screen.getByRole("heading", {name: /ähnliche produkte/i})).toBeInTheDocument();
    });

    // Auf das bestehende Produkt "Tomaten" in der Liste klicken
    const listItems = screen.getAllByRole("button", {name: "Tomaten"});
    // Der letzte Button mit diesem Text ist der ListItemButton im aehnliche-Produkte-Dialog
    const similarProductButton = listItems[listItems.length - 1];
    await userEvent.click(similarProductButton);

    expect(handleChooseExisting).toHaveBeenCalledTimes(1);
    expect(handleChooseExisting.mock.calls[0][0].name).toBe("Tomaten");
  });
});
