/**
 * Unit-Tests für die Beschriftungen der PDF-Abrechnung
 * (expenseReportLabels.ts, Story 7.2): Titel, Dateiname,
 * Datumsformat und Modus-Beschriftungen; Zeile unter der Bezeichnung der
 * Belegseiten (Story 7.3a, Layout 7.5); Name der Kontoinhaber*in (Story 7.4).
 */
import AuthUser from "../../../../Session/authUser.class";
import {ReportMode} from "../expenseReport.types";
import {
  REPORT_MODE_LABELS,
  formatReportDate,
  getAccountHolderName,
  getReportFileName,
  getReceiptMetaLine,
  getReportTitle,
} from "../expenseReportLabels";

describe("getReportTitle", () => {
  test("mit Person: «Abrechnung <Anlass> <Person>»", () => {
    expect(getReportTitle("Sommerlager 2026", "Anna")).toBe(
      "Abrechnung Sommerlager 2026 Anna",
    );
  });

  test("«Alle Personen» (null): ohne Person", () => {
    expect(getReportTitle("Sommerlager 2026", null)).toBe(
      "Abrechnung Sommerlager 2026",
    );
  });

  test("leerer Anlassname: keine doppelten Leerzeichen", () => {
    expect(getReportTitle("", "Anna")).toBe("Abrechnung Anna");
    expect(getReportTitle("", null)).toBe("Abrechnung");
  });
});

describe("getReportFileName", () => {
  test("mit Person: Titel plus Endung .pdf", () => {
    expect(getReportFileName("Sommerlager 2026", "Anna")).toBe(
      "Abrechnung Sommerlager 2026 Anna.pdf",
    );
  });

  test("«Alle Personen» (null): ohne Person", () => {
    expect(getReportFileName("Sommerlager 2026", null)).toBe(
      "Abrechnung Sommerlager 2026.pdf",
    );
  });
});

describe("formatReportDate", () => {
  test("Schweizer Format mit führenden Nullen", () => {
    expect(formatReportDate(new Date(2026, 6, 9))).toBe("09.07.2026");
  });
});

describe("REPORT_MODE_LABELS", () => {
  test("jeder Modus hat Beschriftung und Erklärung", () => {
    Object.values(ReportMode).forEach((reportMode) => {
      expect(REPORT_MODE_LABELS[reportMode].label).not.toBe("");
      expect(REPORT_MODE_LABELS[reportMode].description).not.toBe("");
    });
  });
});

describe("getReceiptMetaLine", () => {
  const RECEIPT = {
    receiptNumber: 3,
    expenseId: "expense-3",
    attachmentPath: null,
    date: new Date(2026, 6, 12),
    label: "Migros",
    amountInCents: 4250,
    currency: "CHF",
  };

  test("«Datum · Budget · Person»", () => {
    expect(
      getReceiptMetaLine(RECEIPT, {
        budgetName: "Küche",
        payeeDisplayName: "Anna",
      }),
    ).toBe("12.07.2026 · Küche · Anna");
  });

  test("ohne Budget und Person: nur das Datum", () => {
    expect(getReceiptMetaLine(RECEIPT, undefined)).toBe("12.07.2026");
  });
});

describe("getAccountHolderName", () => {
  /**
   * Erstellt die angemeldete Person «Gio» mit den gegebenen Namen.
   *
   * @param firstName - Vorname im Profil.
   * @param lastName - Nachname im Profil.
   * @returns Die angemeldete Person mit der UID «user-gio».
   */
  const buildAuthUser = (firstName: string, lastName: string): AuthUser => {
    const authUser = new AuthUser();
    authUser.uid = "user-gio";
    authUser.firstName = firstName;
    authUser.lastName = lastName;
    return authUser;
  };
  const OWN_PAYEE = {displayName: "Gio", payeeUserId: "user-gio"};

  test("eigene Abrechnung: Vor- und Nachname aus dem Profil", () => {
    expect(getAccountHolderName(OWN_PAYEE, buildAuthUser("Gio", "Botta"))).toBe(
      "Gio Botta",
    );
  });

  test("eigene Abrechnung: Leerzeichen um die Namen fallen weg", () => {
    expect(
      getAccountHolderName(OWN_PAYEE, buildAuthUser(" Gio ", "  Botta ")),
    ).toBe("Gio Botta");
  });

  test.each([
    ["ohne Nachname", "Gio", ""],
    ["ohne Vorname", "", "Botta"],
    ["Nachname nur Leerzeichen", "Gio", "   "],
  ])(
    "eigene Abrechnung %s: Anzeigename",
    (_description, firstName, lastName) => {
      expect(
        getAccountHolderName(OWN_PAYEE, buildAuthUser(firstName, lastName)),
      ).toBe("Gio");
    },
  );

  test("andere Köch*in: Anzeigename, nie der eigene Profilname", () => {
    expect(
      getAccountHolderName(
        {displayName: "Anna", payeeUserId: "user-anna"},
        buildAuthUser("Gio", "Botta"),
      ),
    ).toBe("Anna");
  });

  test("eingetippte Person (payeeUserId null): Anzeigename", () => {
    expect(
      getAccountHolderName(
        {displayName: "Hans Muster", payeeUserId: null},
        buildAuthUser("Gio", "Botta"),
      ),
    ).toBe("Hans Muster");
  });
});
