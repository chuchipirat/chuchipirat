/**
 * Unit-Tests für den Dialog «Spende erfassen» (manualDonationDialog.tsx).
 */
import React from "react";
import {act, fireEvent, render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {ManualDonationDialog} from "../manualDonationDialog";
import {ManualPaymentMethod} from "../../../Donate/donation.types";
import {formatLocalDate} from "../../../../utils/dateUtils";
import dayjs from "dayjs";

// Echter DatePicker ist in jsdom schwer zu bedienen; die Attrappe zeigt Wert,
// Grenzen und Hinweis wie das Original
jest.mock("@mui/x-date-pickers", () => ({
  DatePicker: (props: any) => (
    <div>
      <label htmlFor="paid-at">{props.label}</label>
      <input
        id="paid-at"
        value={props.value?.isValid?.() ? props.value.format("YYYY-MM-DD") : ""}
        onChange={(event) => props.onChange?.(dayjs(event.target.value))}
      />
      {props.slotProps?.textField?.helperText}
    </div>
  ),
}));

jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: () => ({}),
}));

const DONOR_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
// relativ zu heute, weil das Datum höchstens ein Jahr zurück liegen darf
const TODAY = new Date();
const TEN_DAYS_AGO = new Date(
  TODAY.getFullYear(),
  TODAY.getMonth(),
  TODAY.getDate() - 10,
);

const makeProps = (
  overrides: Partial<React.ComponentProps<typeof ManualDonationDialog>> = {},
): React.ComponentProps<typeof ManualDonationDialog> => ({
  open: true,
  findDonor: jest
    .fn()
    .mockResolvedValue({uid: DONOR_ID, displayName: "Kim Muster"}),
  loadDonorEvents: jest.fn().mockResolvedValue([
    {uid: "event-1", name: "Sommerlager 2026"},
    {uid: "event-2", name: "Herbstlager"},
  ]),
  createDonation: jest.fn().mockResolvedValue(undefined),
  onClose: jest.fn(),
  onCreated: jest.fn(),
  ...overrides,
});

/** Sucht die Person über die E-Mail-Adresse. */
const searchDonor = async (email = "kim@example.ch") => {
  fireEvent.change(screen.getByLabelText("E-Mail der Person"), {
    target: {value: email},
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", {name: "Suchen"}));
  });
};

/** Wählt einen Eintrag eines Auswahlfelds. */
const selectOption = (fieldName: string, optionName: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", {name: fieldName}));
  fireEvent.click(
    within(screen.getByRole("listbox")).getByRole("option", {name: optionName}),
  );
};

describe("ManualDonationDialog: Person und Anlass", () => {
  test("Anlass erst nach gefundener Person wählbar", () => {
    render(<ManualDonationDialog {...makeProps()} />);

    expect(screen.getByRole("combobox", {name: "Anlass"})).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("gefundene Person: Name sichtbar, ihre Anlässe zur Auswahl", async () => {
    const props = makeProps();
    render(<ManualDonationDialog {...props} />);

    await searchDonor();

    expect(props.findDonor).toHaveBeenCalledWith("kim@example.ch");
    expect(props.loadDonorEvents).toHaveBeenCalledWith(DONOR_ID);
    expect(screen.getByText("Kim Muster")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Anlass"}));
    const listbox = screen.getByRole("listbox");
    expect(
      within(listbox).getByRole("option", {name: "Sommerlager 2026"}),
    ).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", {name: "Kein Anlass"}),
    ).toBeInTheDocument();
  });

  test("keine Person gefunden: Hinweis, Erfassen gesperrt", async () => {
    render(
      <ManualDonationDialog
        {...makeProps({findDonor: jest.fn().mockResolvedValue(null)})}
      />,
    );

    await searchDonor("niemand@example.ch");

    expect(
      screen.getByText("Keine Person mit dieser E-Mail-Adresse gefunden."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Erfassen"})).toBeDisabled();
  });
});

describe("ManualDonationDialog: Erfassen", () => {
  test("übergibt alle Felder und meldet den Erfolg", async () => {
    const props = makeProps();
    render(<ManualDonationDialog {...props} />);
    await searchDonor();
    selectOption("Anlass", "Sommerlager 2026");
    fireEvent.change(screen.getByLabelText("Betrag (CHF)"), {
      target: {value: "25.50"},
    });
    fireEvent.change(screen.getByLabelText("Bezahlt am"), {
      target: {value: formatLocalDate(TEN_DAYS_AGO)},
    });
    selectOption("Zahlungsart", "Banküberweisung");
    fireEvent.change(screen.getByLabelText("Nachricht (optional)"), {
      target: {value: "Danke"},
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "Erfassen"}));
    });

    expect(props.createDonation).toHaveBeenCalledWith({
      donorUid: DONOR_ID,
      eventId: "event-1",
      amountInCents: 2550,
      paidAt: TEN_DAYS_AGO,
      paymentMethod: ManualPaymentMethod.bankTransfer,
      donorMessage: "Danke",
    });
    expect(props.onCreated).toHaveBeenCalled();
  });

  test("ohne Anlass: eventId null", async () => {
    const props = makeProps();
    render(<ManualDonationDialog {...props} />);
    await searchDonor();
    fireEvent.change(screen.getByLabelText("Betrag (CHF)"), {
      target: {value: "10"},
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "Erfassen"}));
    });

    expect(props.createDonation).toHaveBeenCalledWith(
      expect.objectContaining({eventId: null, amountInCents: 1000}),
    );
  });

  test("ohne gültigen Betrag gesperrt", async () => {
    render(<ManualDonationDialog {...makeProps()} />);
    await searchDonor();

    fireEvent.change(screen.getByLabelText("Betrag (CHF)"), {
      target: {value: "abc"},
    });

    expect(screen.getByRole("button", {name: "Erfassen"})).toBeDisabled();
  });

  test("Fehler beim Erfassen erscheint im Dialog", async () => {
    const props = makeProps({
      createDonation: jest.fn().mockRejectedValue({
        code: "22023",
        message: "Die Person kocht nicht in diesem Anlass.",
      }),
    });
    render(<ManualDonationDialog {...props} />);
    await searchDonor();
    fireEvent.change(screen.getByLabelText("Betrag (CHF)"), {
      target: {value: "10"},
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "Erfassen"}));
    });

    expect(
      screen.getByText("Die Person kocht nicht in diesem Anlass."),
    ).toBeInTheDocument();
    expect(props.onCreated).not.toHaveBeenCalled();
  });
});

describe("ManualDonationDialog: Grenzen", () => {
  const fillAmount = (value: string) =>
    fireEvent.change(screen.getByLabelText("Betrag (CHF)"), {
      target: {value},
    });

  test.each([
    ["unter CHF 5", "4.99"],
    ["über CHF 10'000", "10000.01"],
  ])("Betrag %s: gesperrt", async (_case, value) => {
    render(<ManualDonationDialog {...makeProps()} />);
    await searchDonor();

    fillAmount(value);

    expect(screen.getByRole("button", {name: "Erfassen"})).toBeDisabled();
  });

  test("Datum in der Zukunft: gesperrt", async () => {
    render(<ManualDonationDialog {...makeProps()} />);
    await searchDonor();
    fillAmount("10");

    fireEvent.change(screen.getByLabelText("Bezahlt am"), {
      target: {value: "2999-01-01"},
    });

    expect(screen.getByRole("button", {name: "Erfassen"})).toBeDisabled();
  });

  test("Nachricht höchstens 200 Zeichen", () => {
    render(<ManualDonationDialog {...makeProps()} />);

    expect(screen.getByLabelText("Nachricht (optional)")).toHaveAttribute(
      "maxlength",
      "200",
    );
  });

  test("technischer Fehler: allgemeiner Text statt Datenbankdetails", async () => {
    render(
      <ManualDonationDialog
        {...makeProps({
          createDonation: jest.fn().mockRejectedValue({
            code: "23514",
            message:
              'violates check constraint "donations_amount_in_cents_check"',
          }),
        })}
      />,
    );
    await searchDonor();
    fillAmount("10");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "Erfassen"}));
    });

    expect(
      screen.getByText("Die Spende konnte nicht erfasst werden."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/check constraint/)).not.toBeInTheDocument();
  });
});

describe("ManualDonationDialog: Hinweise", () => {
  test("vor der Suche: Hinweis, zuerst die Person zu suchen", () => {
    render(<ManualDonationDialog {...makeProps()} />);

    expect(
      screen.getByText("Suche zuerst die Person über ihre E-Mail-Adresse."),
    ).toBeInTheDocument();
  });

  test("ungültiger Betrag: Hinweis zum erlaubten Bereich als Fehler", async () => {
    render(<ManualDonationDialog {...makeProps()} />);
    await searchDonor();

    fireEvent.change(screen.getByLabelText("Betrag (CHF)"), {
      target: {value: "3"},
    });

    expect(screen.getByLabelText("Betrag (CHF)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText("Gib einen Betrag zwischen CHF 5 und CHF 10'000 ein."),
    ).toBeInTheDocument();
  });

  test("Datum ausserhalb des Bereichs: Hinweis", async () => {
    render(<ManualDonationDialog {...makeProps()} />);

    fireEvent.change(screen.getByLabelText("Bezahlt am"), {
      target: {value: "2999-01-01"},
    });

    expect(
      screen.getByText(
        "Das Datum darf nicht in der Zukunft und höchstens ein Jahr zurück liegen.",
      ),
    ).toBeInTheDocument();
  });
});
