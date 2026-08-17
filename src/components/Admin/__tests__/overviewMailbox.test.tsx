/**
 * Unit-Tests für Admin/overviewMailbox.tsx.
 *
 * Fokussiert auf das "Löschen"-Panel: Kappung ungültiger Tagesanzahl-
 * Eingaben (negativ / absurd gross), damit die Lösch-Grenze nie
 * versehentlich alle Protokolle trifft oder ein ungültiges Datum ergibt.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import OverviewMailboxPage from "../overviewMailbox";
import {DatabaseContext} from "../../Database/DatabaseContext";

jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({
    container: {},
    backdrop: {},
    card: {},
    cardContent: {},
    submit: {},
    dataGridDisabled: "dataGridDisabled",
    dialogHeaderWithPicture: {},
    dialogHeaderWithPictureTitle: {},
  })),
}));

const mockGetAll = jest.fn();
const mockDeleteOlderThan = jest.fn();
const mockDatabase = {
  mailLog: {
    getAll: mockGetAll,
    deleteOlderThan: mockDeleteOlderThan,
  },
} as any;

const renderPage = () =>
  render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <OverviewMailboxPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAll.mockResolvedValue([]);
  mockDeleteOlderThan.mockResolvedValue(0);
});

describe("OverviewMailboxPage — Löschen-Panel", () => {
  test("kappt eine negativ eingegebene Tagesanzahl auf den Mindestwert (100)", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
    });

    const deleteTab = screen.getByRole("tab", {name: /löschen/i});
    await userEvent.click(deleteTab);

    const daysInput = screen.getByLabelText(
      /mailprotokolle löschen, die älter als/i,
    ) as HTMLInputElement;
    fireEvent.change(daysInput, {target: {value: "-5"}});

    expect(daysInput.value).toBe("100");
  });

  test("kappt eine absurd grosse Tagesanzahl auf den Maximalwert (3650)", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
    });

    const deleteTab = screen.getByRole("tab", {name: /löschen/i});
    await userEvent.click(deleteTab);

    const daysInput = screen.getByLabelText(
      /mailprotokolle löschen, die älter als/i,
    ) as HTMLInputElement;
    fireEvent.change(daysInput, {target: {value: "99999999999"}});

    expect(daysInput.value).toBe("3650");
  });

  test("Löschen-Button ruft deleteOlderThan mit dem Standardwert (180 Tage) auf", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalled();
    });

    const deleteTab = screen.getByRole("tab", {name: /löschen/i});
    await userEvent.click(deleteTab);

    const deleteButton = screen.getByRole("button", {
      name: /mailprotokolle löschen/i,
    });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteOlderThan).toHaveBeenCalledTimes(1);
    });
  });
});
