/**
 * Unit-Tests fuer EventCard.
 *
 * Testet das optionale countdown-Badge, den Mehrtages-Wetterstreifen und
 * die klickbare Bereitschafts-Checkliste.
 */
import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";

import {EventCard, EventCardData} from "../eventCard";

/** Mock: ImageRepository */
jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "test-placeholder.png",
      SIGN_IN_HEADER: "test-header.png",
    }),
  },
}));

const mockEvent: EventCardData = {
  uid: "evt-1",
  name: "Sommerlager 2027",
  motto: "Abenteuer",
  pictureSrc: "",
  dates: [],
};

describe("EventCard", () => {
  describe("countdown", () => {
    test("rendert kein Countdown-Badge ohne countdown-Prop", () => {
      render(<EventCard event={mockEvent} onCardClick={jest.fn()} />);

      expect(screen.queryByText(/In \d+ Tagen/)).not.toBeInTheDocument();
      expect(screen.queryByText("Heute")).not.toBeInTheDocument();
    });

    test("rendert das Countdown-Label", () => {
      render(
        <EventCard
          event={mockEvent}
          onCardClick={jest.fn()}
          countdown={{label: "In 5 Tagen"}}
        />,
      );

      expect(screen.getByText("In 5 Tagen")).toBeInTheDocument();
    });
  });

  describe("weatherDays", () => {
    test("rendert keinen Wetterstreifen ohne weatherDays-Prop", () => {
      render(<EventCard event={mockEvent} onCardClick={jest.fn()} />);
      expect(screen.queryByText(/°\//)).not.toBeInTheDocument();
    });

    test("rendert keinen Wetterstreifen bei leerem weatherDays-Array", () => {
      render(
        <EventCard event={mockEvent} onCardClick={jest.fn()} weatherDays={[]} />,
      );
      expect(screen.queryByText(/°\//)).not.toBeInTheDocument();
    });

    test("rendert den Mehrtages-Wetterstreifen", () => {
      render(
        <EventCard
          event={mockEvent}
          onCardClick={jest.fn()}
          weatherDays={[
            {date: "2026-08-03", iconLabel: "☀️", tempMax: 22.4, tempMin: 12.1},
            {date: "2026-08-04", iconLabel: "🌧️", tempMax: 15.2, tempMin: 8.3},
          ]}
        />,
      );

      expect(screen.getByText(/☀️ 22°\/12°/)).toBeInTheDocument();
      expect(screen.getByText(/🌧️ 15°\/8°/)).toBeInTheDocument();
    });
  });

  describe("readiness", () => {
    test("rendert keine Checkliste ohne readiness-Prop", () => {
      render(<EventCard event={mockEvent} onCardClick={jest.fn()} />);
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    test("rendert Checklisten-Eintraege als deaktivierte Checkboxen mit Status", () => {
      render(
        <EventCard
          event={mockEvent}
          onCardClick={jest.fn()}
          readiness={[
            {label: "Verwendete Rezepte", ready: true, onNavigate: jest.fn()},
            {label: "Einkaufsliste", ready: false, onNavigate: jest.fn()},
          ]}
        />,
      );

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[0]).toBeDisabled();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[1]).toBeDisabled();
      expect(screen.getByText("Verwendete Rezepte")).toBeInTheDocument();
      expect(screen.getByText("Einkaufsliste")).toBeInTheDocument();
    });

    test("klickt auf einen Checklisten-Eintrag ohne die Karte zu navigieren", () => {
      const onNavigate = jest.fn();
      const onCardClick = jest.fn();

      render(
        <EventCard
          event={mockEvent}
          onCardClick={onCardClick}
          readiness={[
            {label: "Materialliste", ready: false, onNavigate},
          ]}
        />,
      );

      fireEvent.click(screen.getByText("Materialliste"));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onCardClick).not.toHaveBeenCalled();
    });
  });
});
