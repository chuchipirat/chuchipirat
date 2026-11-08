/**
 * Unit-Tests fuer DialogMaterial im EDIT- und CREATE-Modus.
 *
 * Im CREATE-Modus wird database.materials.insertMaterial (Supabase) aufgerufen.
 * Im EDIT-Modus werden die geaenderten Werte per handleOk-Callback zurueckgegeben.
 * Die Tests pruefen: Vorausfuellen des Formulars, Validierung,
 * Callback-Verhalten, Checkbox- und Radio-Logik.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import * as Sentry from "@sentry/react";
import {DialogMaterial, MaterialDialog} from "../dialogMaterial";
import {MaterialType} from "../material.types";
import AuthUser from "../../Session/authUser.class";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {
  CreationDecision,
  CreationItemType,
  CreationOrigin,
} from "../../Product/CreationLog/creationLog.types";
import {NameHintKind} from "../../Product/Matching/nameHint.types";
import {ERROR_MATERIAL_WITH_THIS_NAME_ALREADY_EXISTS} from "../../../constants/text/masterdata";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

// Auto-Mock: Alle Exports von @sentry/react werden zu jest.fn(),
// damit jest.spyOn auf nicht-konfigurierbare Properties funktioniert.
jest.mock("@sentry/react");

/** Mock-DatabaseService mit insertMaterial-Stub (nur fuer CREATE-Pfad) */
const mockInsertMaterial = jest.fn();
const mockLogCreation = jest.fn().mockResolvedValue(undefined);
const mockDatabase = {
  materials: {insertMaterial: mockInsertMaterial},
  itemCreationLogs: {logCreation: mockLogCreation},
} as any;

const mockAuthUser = {
  uid: "user-1",
  email: "admin@test.ch",
  roles: ["admin"],
} as AuthUser;

const mockMaterials = [
  {uid: "mat-1", name: "Schwingbesen", type: MaterialType.usage, usable: true},
];

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

interface RenderEditOptions {
  dialogOpen?: boolean;
  materialName?: string;
  materialUid?: string;
  materialType?: MaterialType;
  materialUsable?: boolean;
  handleOk?: jest.Mock;
  handleClose?: jest.Mock;
}

/**
 * Rendert den DialogMaterial im EDIT-Modus mit konfigurierbaren Props.
 *
 * @param options - Optionale Konfiguration der Dialog-Props
 * @returns Objekt mit den Mock-Callbacks
 */
const renderEditDialog = (options: RenderEditOptions = {}) => {
  const {
    dialogOpen = true,
    materialName = "Schwingbesen",
    materialUid = "mat-1",
    materialType = MaterialType.usage,
    materialUsable = true,
    handleOk = jest.fn(),
    handleClose = jest.fn(),
  } = options;

  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <DialogMaterial
        dialogType={MaterialDialog.EDIT}
        origin={CreationOrigin.MATERIALS_ADMIN}
        materialName={materialName}
        materialUid={materialUid}
        materialType={materialType}
        materialUsable={materialUsable}
        materials={mockMaterials as any}
        dialogOpen={dialogOpen}
        handleOk={handleOk}
        handleClose={handleClose}
        authUser={mockAuthUser}
      />
    </DatabaseContext.Provider>
  );

  return {handleOk, handleClose};
};

interface RenderCreateOptions {
  dialogOpen?: boolean;
  materialName?: string;
  materialType?: MaterialType;
  materials?: typeof mockMaterials;
  handleOk?: jest.Mock;
  handleClose?: jest.Mock;
}

/**
 * Rendert den DialogMaterial im CREATE-Modus mit konfigurierbaren Props.
 *
 * @param options - Optionale Konfiguration der Dialog-Props
 * @returns Objekt mit den Mock-Callbacks
 */
const renderCreateDialog = (options: RenderCreateOptions = {}) => {
  const {
    dialogOpen = true,
    materialName = "",
    materialType = MaterialType.usage,
    materials = [],
    handleOk = jest.fn(),
    handleClose = jest.fn(),
  } = options;

  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <DialogMaterial
        dialogType={MaterialDialog.CREATE}
        origin={CreationOrigin.MATERIAL_LIST}
        materialName={materialName}
        materialUid=""
        materialType={materialType}
        materialUsable={true}
        materials={materials as any}
        dialogOpen={dialogOpen}
        handleOk={handleOk}
        handleClose={handleClose}
        authUser={mockAuthUser}
      />
    </DatabaseContext.Provider>
  );

  return {handleOk, handleClose};
};

/* ===================================================================
// ======================== Tests — EDIT ==============================
// =================================================================== */

describe("DialogMaterial — EDIT", () => {
  test("Wird mit vorausgefuellten Werten geoeffnet", async () => {
    renderEditDialog();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Schwingbesen")).toBeInTheDocument();
    });

    // Korrekte Radio-Auswahl (usage)
    const usageRadio = screen.getByRole("radio", {name: /gebrauchsmaterial/i});
    expect(usageRadio).toBeChecked();

    // Checkbox "Nutzbar" ist angehakt
    expect(screen.getByRole("checkbox", {name: /nutzbar/i})).toBeChecked();
  });

  test("OK gibt das geaenderte Material zurueck", async () => {
    const handleOk = jest.fn();
    renderEditDialog({handleOk});

    const nameInput = await waitFor(() =>
      screen.getByDisplayValue("Schwingbesen")
    );
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Backform");

    await userEvent.click(screen.getByRole("button", {name: /speichern/i}));

    expect(handleOk).toHaveBeenCalledTimes(1);
    const calledWith = handleOk.mock.calls[0][0];
    expect(calledWith.uid).toBe("mat-1");
    expect(calledWith.name).toBe("Backform");
    expect(calledWith.type).toBe(MaterialType.usage);
    expect(calledWith.usable).toBe(true);
  });

  test("Abbrechen schliesst Dialog ohne Callback", async () => {
    const handleOk = jest.fn();
    const handleClose = jest.fn();
    renderEditDialog({handleOk, handleClose});

    await waitFor(() => screen.getByDisplayValue("Schwingbesen"));
    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleOk).not.toHaveBeenCalled();
  });

  test("Validierung: leerer Name zeigt Fehlermeldung", async () => {
    const handleOk = jest.fn();
    renderEditDialog({handleOk});

    const nameInput = await waitFor(() =>
      screen.getByDisplayValue("Schwingbesen")
    );
    await userEvent.clear(nameInput);

    await userEvent.click(screen.getByRole("button", {name: /speichern/i}));

    expect(screen.getByText("Bitte Materialname eingeben")).toBeInTheDocument();
    expect(handleOk).not.toHaveBeenCalled();
  });

  test("Validierung: kein Typ zeigt Fehlermeldung", async () => {
    const handleOk = jest.fn();
    renderEditDialog({handleOk, materialType: MaterialType.none});

    await waitFor(() => screen.getByDisplayValue("Schwingbesen"));

    await userEvent.click(screen.getByRole("button", {name: /speichern/i}));

    expect(screen.getByText("Bitte Materialtyp wählen")).toBeInTheDocument();
    expect(handleOk).not.toHaveBeenCalled();
  });

  test("Usable-Checkbox aendert Wert", async () => {
    const handleOk = jest.fn();
    renderEditDialog({handleOk, materialUsable: true});

    await waitFor(() => screen.getByDisplayValue("Schwingbesen"));

    const usableCheckbox = screen.getByRole("checkbox", {name: /nutzbar/i});
    await userEvent.click(usableCheckbox); // abwählen

    await userEvent.click(screen.getByRole("button", {name: /speichern/i}));

    expect(handleOk).toHaveBeenCalledTimes(1);
    expect(handleOk.mock.calls[0][0].usable).toBe(false);
  });
});

/* ===================================================================
// ======================== Tests — CREATE ============================
// =================================================================== */

describe("DialogMaterial — CREATE", () => {
  test("Wird mit vorausgefuelltem Namen geoeffnet", async () => {
    renderCreateDialog({materialName: "Pfanne"});

    await waitFor(() => {
      expect(screen.getByDisplayValue("Pfanne")).toBeInTheDocument();
    });
  });

  test("Erfolgreiches Anlegen ruft insertMaterial und handleOk auf", async () => {
    const handleOk = jest.fn();
    const domainResult = {
      uid: "new-mat-99",
      name: "Pfanne",
      type: MaterialType.consumable,
      usable: true,
    };
    mockInsertMaterial.mockResolvedValueOnce(domainResult);

    renderCreateDialog({materialName: "Pfanne", handleOk});

    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    // Typ wählen (consumable)
    const consumableRadio = screen.getByRole("radio", {
      name: /verbrauchsmaterial/i,
    });
    await userEvent.click(consumableRadio);

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    await waitFor(() => {
      expect(mockInsertMaterial).toHaveBeenCalledTimes(1);
    });

    const insertArg = mockInsertMaterial.mock.calls[0][0];
    expect(insertArg.name).toBe("Pfanne");
    expect(insertArg.type).toBe(MaterialType.consumable);
    expect(insertArg.usable).toBe(true);
    expect(mockInsertMaterial.mock.calls[0][1]).toBe(mockAuthUser);

    await waitFor(() => expect(handleOk).toHaveBeenCalledTimes(1));
    const calledWith = handleOk.mock.calls[0][0];
    expect(calledWith.uid).toBe("new-mat-99");
    expect(calledWith.name).toBe("Pfanne");
    expect(calledWith.type).toBe(MaterialType.consumable);
  });

  test("Abbrechen schliesst Dialog ohne DB-Aufruf", async () => {
    const handleOk = jest.fn();
    const handleClose = jest.fn();
    renderCreateDialog({handleOk, handleClose, materialName: "Pfanne"});

    await waitFor(() => screen.getByDisplayValue("Pfanne"));
    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(mockInsertMaterial).not.toHaveBeenCalled();
  });

  test("Validierung: leerer Name verhindert DB-Aufruf", async () => {
    renderCreateDialog({materialName: ""});

    // Typ wählen, damit nur der Name fehlt
    const usageRadio = screen.getByRole("radio", {name: /gebrauchsmaterial/i});
    await userEvent.click(usageRadio);

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    expect(screen.getByText("Bitte Materialname eingeben")).toBeInTheDocument();
    expect(mockInsertMaterial).not.toHaveBeenCalled();
  });

  test("Validierung: kein Typ verhindert DB-Aufruf", async () => {
    renderCreateDialog({
      materialName: "Pfanne",
      materialType: MaterialType.none,
    });

    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    expect(screen.getByText("Bitte Materialtyp wählen")).toBeInTheDocument();
    expect(mockInsertMaterial).not.toHaveBeenCalled();
  });

  test("Validierung: doppelter Name wird abgelehnt", async () => {
    // mockMaterials enthält bereits "Schwingbesen"
    renderCreateDialog({
      materialName: "Schwingbesen",
      materials: mockMaterials,
    });

    await waitFor(() => screen.getByDisplayValue("Schwingbesen"));

    // Typ wählen
    const usageRadio = screen.getByRole("radio", {name: /gebrauchsmaterial/i});
    await userEvent.click(usageRadio);

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    expect(
      screen.getByText(
        /Es existiert bereits ein Material mit diesen Namen/i
      )
    ).toBeInTheDocument();
    expect(mockInsertMaterial).not.toHaveBeenCalled();
  });

  test("insertMaterial-Fehler fuehrt nicht zum Absturz", async () => {
    const handleOk = jest.fn();
    mockInsertMaterial.mockRejectedValueOnce(new Error("DB-Fehler"));
    const sentrySpy = jest
      .spyOn(Sentry, "captureException")
      .mockImplementation(() => "");

    renderCreateDialog({materialName: "Pfanne", handleOk});

    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    const usageRadio = screen.getByRole("radio", {name: /gebrauchsmaterial/i});
    await userEvent.click(usageRadio);

    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    // Kein Absturz, handleOk wird nicht aufgerufen
    await waitFor(() => expect(mockInsertMaterial).toHaveBeenCalledTimes(1));
    expect(handleOk).not.toHaveBeenCalled();

    sentrySpy.mockRestore();
  });
});

/* ===================================================================
// ======================== Anlegen-Protokoll =========================
// =================================================================== */

/** Ein angelegtes Material, wie es insertMaterial zurückgibt. */
const insertedPan = {
  uid: "new-mat-99",
  name: "Pfanne",
  type: MaterialType.usage,
  usable: true,
  qaChecked: false,
  qaCheckedAt: null,
};

/** Wartet einen Makrotask ab, damit nicht abgewartete Promises fertig sind. */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Der Eintrag, der beim ersten Aufruf an logCreation ging. */
const loggedEntry = () => mockLogCreation.mock.calls[0][0];

/** Wählt den Typ und klickt auf «Erstellen». */
const submitAsUsageMaterial = async () => {
  await userEvent.click(
    screen.getByRole("radio", {name: /gebrauchsmaterial/i}),
  );
  await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));
};

describe("DialogMaterial — Anlegen-Protokoll", () => {
  beforeEach(() => {
    mockLogCreation.mockResolvedValue(undefined);
  });

  test("Abbrechen schreibt einen Abbruch mit Art und Herkunft", async () => {
    renderCreateDialog({materialName: "Pfanne"});
    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

    expect(mockLogCreation).toHaveBeenCalledTimes(1);
    expect(loggedEntry()).toEqual({
      itemType: CreationItemType.MATERIAL,
      origin: CreationOrigin.MATERIAL_LIST,
      enteredName: "Pfanne",
      finalName: null,
      decision: CreationDecision.CANCELLED,
      hints: [],
      rulesVersion: 0,
      resultProductId: null,
      resultMaterialId: null,
      resultName: null,
    });
  });

  test("Anlegen schreibt created mit dem neuen Material", async () => {
    mockInsertMaterial.mockResolvedValueOnce(insertedPan);
    const {handleOk} = renderCreateDialog({materialName: "Pfanne"});
    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    await submitAsUsageMaterial();
    await waitFor(() => expect(handleOk).toHaveBeenCalledTimes(1));

    expect(mockLogCreation).toHaveBeenCalledTimes(1);
    expect(loggedEntry()).toMatchObject({
      itemType: CreationItemType.MATERIAL,
      enteredName: "Pfanne",
      finalName: "Pfanne",
      decision: CreationDecision.CREATED,
      hints: [],
      resultProductId: null,
      resultMaterialId: "new-mat-99",
      resultName: "Pfanne",
    });
  });

  test("OK mit bestehendem Namen merkt sich den Hinweis exact_product", async () => {
    renderCreateDialog({
      materialName: "Schwingbesen",
      materials: mockMaterials,
    });
    await waitFor(() => screen.getByDisplayValue("Schwingbesen"));

    await submitAsUsageMaterial();
    expect(
      screen.getByText(ERROR_MATERIAL_WITH_THIS_NAME_ALREADY_EXISTS),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

    expect(mockLogCreation).toHaveBeenCalledTimes(1);
    expect(loggedEntry().decision).toBe(CreationDecision.CANCELLED);
    expect(loggedEntry().hints).toEqual([
      {
        kind: NameHintKind.EXACT_PRODUCT,
        rule: null,
        score: null,
        word: null,
        suggestions: [{id: "mat-1", name: "Schwingbesen", source: "material"}],
      },
    ]);
  });

  test("ESC schreibt einen Abbruch", async () => {
    renderCreateDialog({materialName: "Pfanne"});
    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    await userEvent.keyboard("{Escape}");

    expect(mockLogCreation).toHaveBeenCalledTimes(1);
    expect(loggedEntry().decision).toBe(CreationDecision.CANCELLED);
  });

  test("Klick auf den Hintergrund schreibt nichts (Dialog bleibt offen)", async () => {
    const {handleClose} = renderCreateDialog({materialName: "Pfanne"});
    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    const dialogContainer = document.querySelector(".MuiDialog-container");
    expect(dialogContainer).not.toBeNull();
    await userEvent.click(dialogContainer as Element);

    expect(handleClose).not.toHaveBeenCalled();
    expect(mockLogCreation).not.toHaveBeenCalled();
  });

  test("Anlegen schlägt fehl: kein Eintrag, der Vorgang läuft weiter", async () => {
    mockInsertMaterial.mockRejectedValueOnce(new Error("insert failed"));
    renderCreateDialog({materialName: "Pfanne"});
    await waitFor(() => screen.getByDisplayValue("Pfanne"));

    await submitAsUsageMaterial();
    await flushPromises();

    expect(mockLogCreation).not.toHaveBeenCalled();

    // Danach abbrechen: derselbe Vorgang wird als Abbruch geschrieben
    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));
    expect(mockLogCreation).toHaveBeenCalledTimes(1);
    expect(loggedEntry()).toMatchObject({
      enteredName: "Pfanne",
      decision: CreationDecision.CANCELLED,
    });
  });

  test("EDIT-Modus schreibt weder bei Speichern noch bei Abbrechen oder ESC", async () => {
    renderEditDialog();
    await waitFor(() => screen.getByDisplayValue("Schwingbesen"));

    await userEvent.click(screen.getByRole("button", {name: /speichern/i}));
    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));
    await userEvent.keyboard("{Escape}");

    expect(mockLogCreation).not.toHaveBeenCalled();
  });
});
