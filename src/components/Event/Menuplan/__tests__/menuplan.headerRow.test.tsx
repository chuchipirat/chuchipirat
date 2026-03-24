/**
 * Unit-Tests für menuplan.headerRow.tsx.
 *
 * Testet das Rendering der Menüplan-Kopfzeile mit Tages-Spalten,
 * Einstellungs-Schaltern und Kontext-Menü.
 */
import React from "react";
import "@testing-library/jest-dom";
import {render, screen, fireEvent} from "@testing-library/react";

import {MenuplanHeaderRow} from "../menuplan.headerRow";
import type {Note} from "../menuplan.types";
import type {MenuplanSettings} from "../menuplan.constants";
import {
  SHOW_DETAILS as TEXT_SHOW_DETAILS,
  ENABLE_DRAG_AND_DROP as TEXT_ENABLE_DRAG_AND_DROP,
  ADD_MEAL as TEXT_ADD_MEAL,
  PRINTVERSION as TEXT_PRINTVERSION,
  NOTE as TEXT_NOTE,
  ADD as TEXT_ADD,
} from "../../../../constants/text";

const mockCustomDialog = jest.fn().mockResolvedValue({valid: false, input: ""});
jest.mock("../../../Shared/customDialogContext", () => ({
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
  DialogType: {SingleTextInput: "SingleTextInput"},
}));

jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({menuplanItem: {}, cardDate: {}})),
}));

function buildDates(): Date[] {
  return [new Date(2026, 2, 10), new Date(2026, 2, 11)];
}

function buildNotes(): {[key: string]: Note} {
  return {};
}

function buildSettings(): MenuplanSettings {
  return {showDetails: false, enableDragAndDrop: false};
}

const defaultProps = {
  dates: buildDates(),
  notes: buildNotes(),
  menuplanSettings: buildSettings(),
  onSwitchShowDetails: jest.fn(),
  onSwitchEnableDragAndDrop: jest.fn(),
  onMealTypeUpdate: jest.fn(),
  onNoteUpdate: jest.fn(),
  onPrint: jest.fn(),
};

describe("MenuplanHeaderRow", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sollte Einstellungs-Schalter rendern", () => {
    render(<MenuplanHeaderRow {...defaultProps} />);

    expect(screen.getByText(TEXT_SHOW_DETAILS)).toBeInTheDocument();
    expect(screen.getByText(TEXT_ENABLE_DRAG_AND_DROP)).toBeInTheDocument();
  });

  it("sollte Buttons für Mahlzeit hinzufügen und Druckversion anzeigen", () => {
    render(<MenuplanHeaderRow {...defaultProps} />);

    expect(screen.getByText(TEXT_ADD_MEAL)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PRINTVERSION)).toBeInTheDocument();
  });

  it("sollte Tages-Spalten mit Wochentag rendern", () => {
    render(<MenuplanHeaderRow {...defaultProps} />);

    // Die Daten werden als Wochentag angezeigt
    const dayCards = screen.getAllByRole("button", {name: "settings"});
    // Eine Karte pro Tag + evtl. andere Buttons
    expect(dayCards.length).toBeGreaterThanOrEqual(2);
  });

  it("sollte onSwitchShowDetails aufrufen wenn Detail-Schalter getoggelt wird", () => {
    render(<MenuplanHeaderRow {...defaultProps} />);

    // MUI Switch wird als checkbox gerendert
    const detailsSwitch = screen.getByLabelText(TEXT_SHOW_DETAILS);
    fireEvent.click(detailsSwitch);

    expect(defaultProps.onSwitchShowDetails).toHaveBeenCalledTimes(1);
  });

  it("sollte onSwitchEnableDragAndDrop aufrufen wenn DnD-Schalter getoggelt wird", () => {
    render(<MenuplanHeaderRow {...defaultProps} />);

    const dndSwitch = screen.getByLabelText(TEXT_ENABLE_DRAG_AND_DROP);
    fireEvent.click(dndSwitch);

    expect(defaultProps.onSwitchEnableDragAndDrop).toHaveBeenCalledTimes(1);
  });

  it("sollte onPrint aufrufen wenn Druckversion geklickt wird", () => {
    render(<MenuplanHeaderRow {...defaultProps} />);

    fireEvent.click(screen.getByText(TEXT_PRINTVERSION));

    expect(defaultProps.onPrint).toHaveBeenCalledTimes(1);
  });

  it("sollte keine Schalter und Buttons rendern wenn keine Daten vorhanden", () => {
    render(<MenuplanHeaderRow {...defaultProps} dates={[]} />);

    expect(screen.queryByText(TEXT_SHOW_DETAILS)).not.toBeInTheDocument();
    expect(screen.queryByText(TEXT_ADD_MEAL)).not.toBeInTheDocument();
  });

  it("sollte Notiz-Text anzeigen wenn eine Tages-Notiz vorhanden ist", () => {
    const notes: {[key: string]: Note} = {
      "note-1": {
        uid: "note-1",
        text: "Testnotiz für den Tag",
        date: "2026-03-10",
        menueUid: "", // Tages-Notiz hat leeren menueUid
      },
    };
    render(<MenuplanHeaderRow {...defaultProps} notes={notes} />);

    expect(screen.getByText("Testnotiz für den Tag")).toBeInTheDocument();
  });
});
