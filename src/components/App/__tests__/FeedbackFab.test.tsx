// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {FeedbackFab} from "../FeedbackFab";

jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({fabBottom: {position: "fixed", bottom: 16, right: 16}})),
}));

jest.mock("../../Shared/icons", () => ({
  FeedbackIcon: () => <span data-testid="feedback-icon">Feedback</span>,
}));

describe("FeedbackFab", () => {
  test("rendert einen Fab mit id='custom-feedback-button'", () => {
    render(<FeedbackFab />);
    const fab = screen.getByRole("button");
    expect(fab).toHaveAttribute("id", "custom-feedback-button");
  });

  test("hat aria-label 'Feedback geben'", () => {
    render(<FeedbackFab />);
    const fab = screen.getByLabelText("Feedback geben");
    expect(fab).toBeInTheDocument();
  });
});
