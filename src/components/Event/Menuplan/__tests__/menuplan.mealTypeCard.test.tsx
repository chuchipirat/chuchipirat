/**
 * Unit-Tests für menuplan.mealTypeCard.tsx.
 *
 * Testet das Rendering der Mahlzeitentyp-Karte mit Kontextmenü.
 */
import React from "react";
import "@testing-library/jest-dom";
import {render, screen, fireEvent} from "@testing-library/react";

import {MealTypeCard} from "../menuplan.mealTypeCard";
import type {MealType} from "../menuplan.types";
import {
  RENAME as TEXT_RENAME,
  DELETE as TEXT_DELETE,
  TOOLTIP_MOVE_UP as TEXT_TOOLTIP_MOVE_UP,
  TOOLTIP_MOVE_DOWN as TEXT_TOOLTIP_MOVE_DOWN,
} from "../../../../constants/text";

/* =====================================================================
// Mocks
// ===================================================================== */
const mockCustomDialog = jest.fn().mockResolvedValue({valid: false, input: ""});
jest.mock("../../../Shared/customDialogContext", () => ({
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
  DialogType: {SingleTextInput: "SingleTextInput"},
}));

jest.mock("../../../../constants/styles", () => () => ({
  cardMealType: {},
}));

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */
const defaultMealType: MealType = {uid: "mt-1", name: "Frühstück"};

const defaultProps = {
  mealType: defaultMealType,
  index: 0,
  isLastElement: false,
  onMealTypeUpdate: jest.fn(),
  onMoveDragAndDropElement: jest.fn(),
};

/* =====================================================================
// Tests
// ===================================================================== */
describe("MealTypeCard", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sollte den Namen des Mahlzeitentyps anzeigen", () => {
    render(<MealTypeCard {...defaultProps} />);

    expect(screen.getByText("Frühstück")).toBeInTheDocument();
  });

  it("sollte Kontextmenü mit Umbenennen, Löschen, Hoch, Runter anzeigen", () => {
    render(<MealTypeCard {...defaultProps} />);

    // Kontextmenü öffnen
    const menuButton = screen.getByRole("button", {name: "settings"});
    fireEvent.click(menuButton);

    expect(screen.getByText(TEXT_RENAME)).toBeInTheDocument();
    expect(screen.getByText(TEXT_DELETE)).toBeInTheDocument();
    expect(screen.getByText(TEXT_TOOLTIP_MOVE_UP)).toBeInTheDocument();
    expect(screen.getByText(TEXT_TOOLTIP_MOVE_DOWN)).toBeInTheDocument();
  });

  it("sollte 'Hoch'-MenuItem deaktivieren wenn index=0", () => {
    render(<MealTypeCard {...defaultProps} index={0} />);

    const menuButton = screen.getByRole("button", {name: "settings"});
    fireEvent.click(menuButton);

    const moveUpItem = screen.getByText(TEXT_TOOLTIP_MOVE_UP).closest("li");
    expect(moveUpItem).toHaveAttribute("aria-disabled", "true");
  });

  it("sollte 'Runter'-MenuItem deaktivieren wenn isLastElement", () => {
    render(<MealTypeCard {...defaultProps} isLastElement={true} />);

    const menuButton = screen.getByRole("button", {name: "settings"});
    fireEvent.click(menuButton);

    const moveDownItem = screen
      .getByText(TEXT_TOOLTIP_MOVE_DOWN)
      .closest("li");
    expect(moveDownItem).toHaveAttribute("aria-disabled", "true");
  });

  it("sollte onMealTypeUpdate mit DELETE aufrufen wenn Löschen geklickt wird", () => {
    render(<MealTypeCard {...defaultProps} />);

    const menuButton = screen.getByRole("button", {name: "settings"});
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByText(TEXT_DELETE));

    expect(defaultProps.onMealTypeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.anything(),
        mealType: defaultMealType,
      })
    );
  });

  it("sollte onMoveDragAndDropElement mit 'down' aufrufen", () => {
    render(<MealTypeCard {...defaultProps} />);

    const menuButton = screen.getByRole("button", {name: "settings"});
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByText(TEXT_TOOLTIP_MOVE_DOWN));

    expect(defaultProps.onMoveDragAndDropElement).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "down",
        itemUid: "mt-1",
      })
    );
  });
});
