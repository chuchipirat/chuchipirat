/**
 * Unit-Test für die ScrollToTop-Komponente.
 *
 * Testet, ob beim Routenwechsel nach oben gescrollt wird.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router";

import {ScrollToTop} from "../ScrollToTop";

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("ScrollToTop", () => {
  test("ruft window.scrollTo beim Rendern auf", () => {
    const scrollToSpy = jest.spyOn(window, "scrollTo").mockImplementation();

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <ScrollToTop />
      </MemoryRouter>
    );

    expect(scrollToSpy).toHaveBeenCalledWith({top: 0, behavior: "smooth"});
    scrollToSpy.mockRestore();
  });
});
