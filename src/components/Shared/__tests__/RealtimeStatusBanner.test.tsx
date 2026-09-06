/**
 * Unit-Tests für RealtimeStatusBanner.
 */
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {RealtimeStatusBanner} from "../RealtimeStatusBanner";

describe("RealtimeStatusBanner", () => {
  test("rendert nichts bei status 'connected'", () => {
    const {container} = render(
      <RealtimeStatusBanner status="connected" onRetry={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("zeigt einen Reconnect-Hinweis bei status 'reconnecting'", () => {
    render(<RealtimeStatusBanner status="reconnecting" onRetry={jest.fn()} />);

    expect(
      screen.getByText(/Verbindung wird wiederhergestellt/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {name: /erneut versuchen/i}),
    ).not.toBeInTheDocument();
  });

  test("zeigt einen Fehler-Hinweis mit Retry-Button bei status 'failed'", async () => {
    const onRetry = jest.fn();
    render(<RealtimeStatusBanner status="failed" onRetry={onRetry} />);

    expect(
      screen.getByText(/Live-Aktualisierung momentan nicht möglich/i),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", {name: /erneut versuchen/i});
    await userEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
