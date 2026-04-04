/**
 * Unit-Tests für dialogGoods.tsx.
 *
 * Testet die getQuantityError-Validierungslogik (intern) durch Rendering
 * des Dialogs und Prüfung der Fehlermeldungen.
 */
import React from "react";
import "@testing-library/jest-dom";
import {render, screen, fireEvent} from "@testing-library/react";

import {DialogGoods} from "../dialogGoods";
import {GoodsType} from "../menuplan.types";
import AuthUser from "../../../Firebase/Authentication/authUser.class";
import {Product} from "../../../Product/product.types";
import {Material} from "../../../Material/material.types";
import {Unit} from "../../../Unit/unit.class";
import Department from "../../../Department/department.class";

import {
  QUANTITY_MUST_BE_POSITIVE as TEXT_QUANTITY_MUST_BE_POSITIVE,
  CANCEL as TEXT_CANCEL,
  OK as TEXT_OK,
  PRODUCTS as TEXT_PRODUCTS,
  MATERIAL as TEXT_MATERIAL,
} from "../../../../constants/text";


// Supabase Mocks
jest.mock("../../../Product/dialogProduct", () => ({
  __esModule: true,
  DialogProduct: () => null,
  PRODUCT_POP_UP_VALUES_INITIAL_STATE: {
    name: "",
    uid: "",
    dietProperties: {},
    usable: true,
  },
  ProductDialog: {CREATE: "CREATE", EDIT: "EDIT"},
}));
jest.mock("../../../Material/dialogMaterial", () => ({
  __esModule: true,
  DialogMaterial: () => null,
  MATERIAL_POP_UP_VALUES_INITIAL_STATE: {
    name: "",
    uid: "",
    type: 0,
    usable: true,
  },
  MaterialDialog: {CREATE: "CREATE", EDIT: "EDIT"},
}));
jest.mock("../../../Product/productAutocomplete", () => ({
  __esModule: true,
  ProductAutocomplete: () => <div data-testid="product-autocomplete" />,
}));
jest.mock("../../../Material/materialAutocomplete", () => ({
  __esModule: true,
  MaterialAutocomplete: () => <div data-testid="material-autocomplete" />,
}));
jest.mock("../../../Unit/unitAutocomplete", () => ({
  UnitAutocomplete: () => <div data-testid="unit-autocomplete" />,
}));


function buildAuthUser(): AuthUser {
  const user = new AuthUser();
  user.uid = "user-1";
  user.publicProfile = {
    displayName: "Test User",
    motto: "",
    pictureSrc: "",
  };
  return user;
}

const defaultProps = {
  open: true,
  goodsType: GoodsType.PRODUCT,
  units: [] as Unit[],
  products: [] as Product[],
  materials: [] as Material[],
  productToUpdate: null,
  materialToUpdate: null,
  departments: [] as Department[],
  authUser: buildAuthUser(),
  onCancel: jest.fn(),
  onOk: jest.fn(),
  onMaterialCreate: jest.fn(),
  onProductCreate: jest.fn(),
};

describe("DialogGoods", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sollte den Dialog für Produkte rendern", () => {
    render(<DialogGoods {...defaultProps} />);

    expect(screen.getByText(TEXT_PRODUCTS)).toBeInTheDocument();
    expect(screen.getByText(TEXT_CANCEL)).toBeInTheDocument();
    expect(screen.getByText(TEXT_OK)).toBeInTheDocument();
  });

  it("sollte den Dialog für Materialien rendern", () => {
    render(
      <DialogGoods {...defaultProps} goodsType={GoodsType.MATERIAL} />
    );

    expect(screen.getByText(TEXT_MATERIAL)).toBeInTheDocument();
  });

  it("sollte den OK-Button deaktivieren wenn kein Produkt/Material gewählt ist", () => {
    render(<DialogGoods {...defaultProps} />);

    const okButton = screen.getByText(TEXT_OK).closest("button");
    expect(okButton).toBeDisabled();
  });

  it("sollte onCancel aufrufen wenn Abbrechen geklickt wird", () => {
    render(<DialogGoods {...defaultProps} />);

    fireEvent.click(screen.getByText(TEXT_CANCEL));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("sollte Fehlermeldung bei negativer Menge anzeigen", () => {
    render(<DialogGoods {...defaultProps} />);

    // Menge auf -1 setzen
    const quantityInput = screen.getByLabelText(/Menge/i);
    fireEvent.change(quantityInput, {target: {id: "quantity", value: "-1"}});

    // Fehlermeldung sichtbar
    expect(screen.getByText(TEXT_QUANTITY_MUST_BE_POSITIVE)).toBeInTheDocument();
  });

  it("sollte Fehlermeldung bei zu grosser Menge anzeigen", () => {
    render(<DialogGoods {...defaultProps} />);

    // Menge auf 100000 setzen
    const quantityInput = screen.getByLabelText(/Menge/i);
    fireEvent.change(quantityInput, {
      target: {id: "quantity", value: "100000"},
    });

    // TEXT_QUANTITY_TOO_LARGE enthält \u2009 (thin space) — getByText
    // normalisiert Whitespace und findet den Thin Space nicht exakt.
    // Daher via id des MUI-HelperText-Elements suchen.
    const helperText = document.getElementById("quantity-helper-text");
    expect(helperText).toBeInTheDocument();
    expect(helperText!.textContent).toContain("99");
    expect(helperText!.textContent).toContain("999");
  });
});
