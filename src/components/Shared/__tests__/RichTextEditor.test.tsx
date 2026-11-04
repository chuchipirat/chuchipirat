/**
 * Unit-Tests für den RichTextEditor (TipTap).
 *
 * Fokus: Link-Erweiterung genau einmal registriert, sichere Link-Attribute,
 * Links öffnen sich beim Bearbeiten nicht, kontrollierter Wert von aussen,
 * Rendern im StrictMode. Die übrigen Tests der App mocken den Editor weg, darum läuft
 * hier das echte TipTap in jsdom.
 */
import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {RichTextEditor} from "../RichTextEditor";

/** Attribut-Wert, den jeder Link im Editor tragen muss. */
const EXPECTED_LINK_REL = "noopener noreferrer nofollow";

describe("RichTextEditor", () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  /**
   * Sammelt alle Warnungen von TipTap (Präfix «[tiptap warn]») als Text.
   * MUI-Warnungen (z.B. Tooltip auf deaktiviertem Knopf) gehören nicht dazu.
   */
  const collectTiptapWarnings = (): string =>
    consoleWarnSpy.mock.calls
      .flat()
      .map(String)
      .filter((message) => message.includes("[tiptap warn]"))
      .join("\n");

  it("registriert jede Erweiterung nur einmal", () => {
    render(<RichTextEditor value="<p>Hallo</p>" onChange={jest.fn()} />);

    expect(collectTiptapWarnings()).not.toMatch(/Duplicate extension/);
  });

  it("versieht Links mit rel noopener noreferrer nofollow", () => {
    const {container} = render(
      <RichTextEditor
        value='<p><a href="https://chuchipirat.ch">Startseite</a></p>'
        onChange={jest.fn()}
      />,
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute("href", "https://chuchipirat.ch");
    expect(link).toHaveAttribute("rel", EXPECTED_LINK_REL);
  });

  describe("Klick auf einen Link", () => {
    const originalElementFromPoint = document.elementFromPoint;
    const originalGetClientRects = Range.prototype.getClientRects;
    const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
    let windowOpenSpy: jest.SpyInstance;

    beforeEach(() => {
      windowOpenSpy = jest.spyOn(window, "open").mockImplementation(() => null);

      // jsdom kennt kein Layout. ProseMirror bestimmt die Klickposition über
      // elementFromPoint und die Rechtecke eines Range; ohne diese Stubs
      // bricht der Klick ab, bevor die Link-Erweiterung ihn sieht.
      const emptyRect = new DOMRect(0, 0, 0, 0);
      document.elementFromPoint = () => screen.getByText("Startseite");
      Range.prototype.getClientRects = () =>
        Object.assign([emptyRect], {
          item: () => emptyRect,
        }) as unknown as DOMRectList;
      Range.prototype.getBoundingClientRect = () => emptyRect;
    });

    afterEach(() => {
      windowOpenSpy.mockRestore();
      document.elementFromPoint = originalElementFromPoint;
      Range.prototype.getClientRects = originalGetClientRects;
      Range.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    });

    it("öffnet den Link beim Bearbeiten nicht", async () => {
      render(
        <RichTextEditor
          value='<p><a href="https://chuchipirat.ch">Startseite</a></p>'
          onChange={jest.fn()}
        />,
      );

      await userEvent.click(screen.getByText("Startseite"));

      expect(windowOpenSpy).not.toHaveBeenCalled();
    });
  });

  it("übernimmt einen neuen Wert von aussen", () => {
    const {rerender} = render(
      <RichTextEditor value="<p>Erster Text</p>" onChange={jest.fn()} />,
    );
    expect(screen.getByText("Erster Text")).toBeInTheDocument();

    rerender(
      <RichTextEditor value="<p>Zweiter Text</p>" onChange={jest.fn()} />,
    );

    expect(screen.getByText("Zweiter Text")).toBeInTheDocument();
    expect(screen.queryByText("Erster Text")).not.toBeInTheDocument();
  });

  it("meldet beim Übernehmen eines Werts von aussen keine Änderung zurück", () => {
    const onChange = jest.fn();
    const {rerender} = render(
      <RichTextEditor value="<p>Erster Text</p>" onChange={onChange} />,
    );

    rerender(<RichTextEditor value="<p>Zweiter Text</p>" onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  // Der Absturz auf einer bereits zerstörten Editor-Instanz (React StrictMode
  // ruft Effekte im Development doppelt auf) lässt sich in jsdom nicht
  // nachstellen. Dieser Test hält nur fest, dass der Editor im StrictMode
  // rendert; den eigentlichen Fall deckt die Prüfung im Browser ab.
  it("rendert den Inhalt im StrictMode", () => {
    render(
      <React.StrictMode>
        <RichTextEditor value="<p>Hallo</p>" onChange={jest.fn()} />
      </React.StrictMode>,
    );

    expect(screen.getByText("Hallo")).toBeInTheDocument();
  });
});
