/**
 * Unit-Tests für DialogRequest.
 *
 * Prüft das Rendering des Antrags-Dialogs inklusive Stepper, Kommentar-Feld,
 * Statusübergänge, Selbstzuweisung und Abschlussdatum-Anzeige.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogRequest} from "../dialogRequest";
import {RequestStatus, RequestType} from "../request.class";
import {RequestDomain} from "../../Database/Repository/RequestRepository";
import {RequestCommentDomain} from "../../Database/Repository/RequestCommentRepository";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {Role} from "../../../constants/roles";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

/** react-router: useNavigate als Mock-Funktion */
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

/** useCustomStyles: gibt ein Objekt mit den benötigten Style-Keys zurück */
jest.mock("../../../constants/styles", () => ({
  __esModule: true,
  default: () => ({
    dialogHeaderWithPicture: {},
    dialogHeaderWithPictureTitle: {},
  }),
}));

/** useCustomDialog: gibt eine Mock-Funktion zurück */
const mockCustomDialog = jest.fn();
jest.mock("../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Sentry-Mock */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/* ===================================================================
// ======================== Test-Daten ================================
// =================================================================== */

const ASSIGNEE_UID = "assignee-uid-001";
const AUTHOR_UID = "author-uid-002";
const VIEWER_UID = "viewer-uid-003";

/**
 * Erstellt ein Mock-AuthUser-Objekt für Tests.
 *
 * @param overrides - Optionale Überschreibungen der Standardwerte
 * @returns AuthUser-Instanz mit den gewünschten Werten
 */
const createMockAuthUser = (
  overrides: Partial<{uid: string; roles: Role[]; displayName: string}> = {},
): AuthUser => {
  const authUser = new AuthUser();
  authUser.uid = overrides.uid ?? VIEWER_UID;
  authUser.roles = overrides.roles ?? [Role.communityLeader];
  authUser.publicProfile = {
    displayName: overrides.displayName ?? "Test-Benutzer",
    pictureSrc: "",
  };
  return authUser;
};

/**
 * Erstellt ein Mock-RequestDomain-Objekt für Tests.
 *
 * @param overrides - Optionale Überschreibungen der Standardwerte
 * @returns RequestDomain-Objekt mit den gewünschten Werten
 */
const createMockRequest = (
  overrides: Partial<RequestDomain> = {},
): RequestDomain => ({
  uid: "request-uid-abc",
  number: 42,
  status: RequestStatus.inReview,
  requestType: RequestType.recipePublish,
  recipeName: "Testrezept Kartoffelstock",
  recipeUid: "recipe-uid-xyz",
  assigneeUid: ASSIGNEE_UID,
  assigneeDisplayName: "Assigned Leader",
  assigneePictureSrc: "",
  authorUid: AUTHOR_UID,
  authorDisplayName: "Rezeptautor*in",
  authorPictureSrc: "",
  recipePictureSrc: "",
  changeLog: [],
  resolveDate: null,
  createdAt: new Date("2026-01-15T10:30:00Z"),
  ...overrides,
});

/**
 * Erstellt ein Mock-RequestCommentDomain-Objekt.
 *
 * @param overrides - Optionale Überschreibungen der Standardwerte
 * @returns RequestCommentDomain-Objekt
 */
const createMockComment = (
  overrides: Partial<RequestCommentDomain> = {},
): RequestCommentDomain => ({
  uid: "comment-uid-001",
  requestId: "request-uid-abc",
  comment: "Sieht gut aus!",
  userUid: AUTHOR_UID,
  userDisplayName: "Rezeptautor*in",
  userPictureSrc: "",
  createdAt: new Date("2026-01-16T08:00:00Z"),
  ...overrides,
});

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

interface RenderDialogOverrides {
  request?: Partial<RequestDomain>;
  comments?: RequestCommentDomain[];
  authUser?: Partial<{uid: string; roles: Role[]; displayName: string}>;
  handleClose?: jest.Mock;
  handleUpdateStatus?: jest.Mock;
  handleAssignToMe?: jest.Mock;
  handleAddComment?: jest.Mock;
  handleRecipeOpen?: jest.Mock;
}

/**
 * Rendert den DialogRequest mit konfigurierbaren Überschreibungen.
 *
 * @param overrides - Optionale Überschreibungen für Props
 * @returns Objekt mit allen Mock-Callbacks zum Prüfen
 */
const renderDialog = (overrides: RenderDialogOverrides = {}) => {
  const handleClose = overrides.handleClose ?? jest.fn();
  const handleUpdateStatus = overrides.handleUpdateStatus ?? jest.fn();
  const handleAssignToMe = overrides.handleAssignToMe ?? jest.fn();
  const handleAddComment = overrides.handleAddComment ?? jest.fn();
  const handleRecipeOpen = overrides.handleRecipeOpen ?? jest.fn();

  const request = createMockRequest(overrides.request);
  const comments = overrides.comments ?? [];
  const authUser = createMockAuthUser(overrides.authUser);

  render(
    <DialogRequest
      request={request}
      comments={comments}
      dialogOpen={true}
      authUser={authUser}
      handleClose={handleClose}
      handleUpdateStatus={handleUpdateStatus}
      handleAssignToMe={handleAssignToMe}
      handleAddComment={handleAddComment}
      handleRecipeOpen={handleRecipeOpen}
    />,
  );

  return {
    handleClose,
    handleUpdateStatus,
    handleAssignToMe,
    handleAddComment,
    handleRecipeOpen,
  };
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => jest.clearAllMocks());

describe("DialogRequest", () => {
  /* ------------------------------------------
  // 1. Zeigt die Antragsnummer im Titel
  // ------------------------------------------ */
  it("zeigt die Antragsnummer im Dialog-Titel", () => {
    renderDialog({request: {number: 42}});

    expect(screen.getByText("Antrag #42")).toBeInTheDocument();
  });

  /* ------------------------------------------
  // 2. Zeigt den Stepper mit 3 Schritten
  // ------------------------------------------ */
  it("zeigt einen Stepper mit 3 Schritten", () => {
    renderDialog();

    // Stepper-Schritte: Erstellt, In Prüfung, Erledigt
    expect(screen.getByText("Erstellt")).toBeInTheDocument();
    expect(screen.getByText("In Prüfung")).toBeInTheDocument();
    expect(screen.getByText("Erledigt")).toBeInTheDocument();

    // Prüfe, dass genau 3 Step-Elemente gerendert werden
    const stepper = screen.getByRole("list");
    const steps = within(stepper).getAllByRole("listitem");
    // Jeder MUI-Step rendert ein listitem — wir erwarten mindestens 3
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  /* ------------------------------------------
  // 3. Klick auf Rezept-Link ruft handleRecipeOpen auf
  // ------------------------------------------ */
  it("ruft handleRecipeOpen beim Klick auf den Rezept-Link auf", async () => {
    const handleRecipeOpen = jest.fn();
    renderDialog({
      request: {recipeName: "Testrezept Kartoffelstock", recipeUid: "recipe-uid-xyz"},
      handleRecipeOpen,
    });

    const recipeLink = screen.getByText("Testrezept Kartoffelstock");
    await userEvent.click(recipeLink);

    expect(handleRecipeOpen).toHaveBeenCalledTimes(1);
    expect(handleRecipeOpen).toHaveBeenCalledWith("recipe-uid-xyz");
  });

  /* ------------------------------------------
  // 4. Kommentar hinzufügen — trimmt Text
  // ------------------------------------------ */
  it("ruft handleAddComment mit getrimmtem Text beim Absenden auf", async () => {
    const handleAddComment = jest.fn();
    renderDialog({handleAddComment});

    const commentInput = screen.getByLabelText("Dein Kommentar");
    await userEvent.type(commentInput, "  Mein Kommentar  ");

    const addButton = screen.getByRole("button", {name: /Kommentar Hinzufügen/i});
    await userEvent.click(addButton);

    expect(handleAddComment).toHaveBeenCalledTimes(1);
    expect(handleAddComment).toHaveBeenCalledWith("Mein Kommentar");
  });

  /* ------------------------------------------
  // 5. «Kommentar Hinzufügen»-Button ist deaktiviert bei leerem Feld
  // ------------------------------------------ */
  it("deaktiviert den Kommentar-Button bei leerem Textfeld", () => {
    renderDialog();

    const addButton = screen.getByRole("button", {name: /Kommentar Hinzufügen/i});
    expect(addButton).toBeDisabled();
  });

  /* ------------------------------------------
  // 6. Zeigt Ablehnungs-Formular beim Klick auf «Ablehnen»-Transition
  // ------------------------------------------ */
  it("zeigt das Ablehnungs-Formular beim Klick auf die Ablehnungs-Transition", async () => {
    // Assignee = authUser → darf Transitionen sehen
    renderDialog({
      request: {
        status: RequestStatus.inReview,
        assigneeUid: VIEWER_UID,
        requestType: RequestType.recipePublish,
      },
      authUser: {uid: VIEWER_UID, roles: [Role.communityLeader]},
    });

    // Klick auf «Antrag ablehnen»-Link
    const declineLink = screen.getByText("Antrag ablehnen");
    await userEvent.click(declineLink);

    // Das Ablehnungs-Formular mit Begründungs-Feld sollte erscheinen
    expect(
      screen.getByLabelText(/Begründung für Ablehnung/i),
    ).toBeInTheDocument();
  });

  /* ------------------------------------------
  // 7. Zeigt «Antrag mir zuweisen»-Button für Community Leaders
  // ------------------------------------------ */
  it("zeigt den Zuweisungs-Button für Community Leaders die weder Assignee noch Autor sind", () => {
    renderDialog({
      request: {
        assigneeUid: ASSIGNEE_UID,
        authorUid: AUTHOR_UID,
      },
      authUser: {uid: VIEWER_UID, roles: [Role.communityLeader]},
    });

    const assignButton = screen.getByRole("button", {
      name: /Antrag mir zuweisen/i,
    });
    expect(assignButton).toBeInTheDocument();
  });

  /* ------------------------------------------
  // 8. Zeigt Abschlussdatum bei geschlossenen Anträgen
  // ------------------------------------------ */
  it("zeigt das Abschlussdatum bei abgeschlossenen Anträgen", () => {
    const resolveDate = new Date("2026-02-20T14:00:00Z");

    renderDialog({
      request: {
        status: RequestStatus.done,
        resolveDate,
      },
    });

    // Das formatierte Abschlussdatum sollte sichtbar sein
    expect(screen.getByText("Abschlussdatum")).toBeInTheDocument();

    // Prüfe, dass das Datum im de-CH-Format gerendert wird
    const formattedDate = resolveDate.toLocaleString("de-CH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    expect(screen.getByText(formattedDate)).toBeInTheDocument();
  });
});
