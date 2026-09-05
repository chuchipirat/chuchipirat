/**
 * Unit-Tests für useRealtimeConnectionStatus und die reine
 * aggregateRealtimeStatus-Funktion.
 */
import {renderHook, act} from "@testing-library/react";
import {
  aggregateRealtimeStatus,
  useRealtimeConnectionStatus,
} from "../useRealtimeConnectionStatus";

/* =====================================================================
// aggregateRealtimeStatus
// ===================================================================== */

describe("aggregateRealtimeStatus", () => {
  test("liefert 'connected' bei leerer Liste", () => {
    expect(aggregateRealtimeStatus([])).toBe("connected");
  });

  test("liefert 'connected', wenn alle verbunden sind", () => {
    expect(aggregateRealtimeStatus(["connected", "connected"])).toBe(
      "connected",
    );
  });

  test("liefert 'reconnecting', wenn mindestens eine Subscription reconnected", () => {
    expect(aggregateRealtimeStatus(["connected", "reconnecting"])).toBe(
      "reconnecting",
    );
  });

  test("liefert 'failed', sobald eine Subscription endgültig aufgegeben hat — auch neben 'reconnecting'", () => {
    expect(aggregateRealtimeStatus(["reconnecting", "failed"])).toBe(
      "failed",
    );
    expect(aggregateRealtimeStatus(["connected", "failed"])).toBe("failed");
  });
});

/* =====================================================================
// useRealtimeConnectionStatus
// ===================================================================== */

describe("useRealtimeConnectionStatus", () => {
  test("overallStatus startet bei 'connected'", () => {
    const {result} = renderHook(() => useRealtimeConnectionStatus());
    expect(result.current.overallStatus).toBe("connected");
  });

  test("setStatus aktualisiert overallStatus", () => {
    const {result} = renderHook(() => useRealtimeConnectionStatus());

    act(() => result.current.setStatus("event", "reconnecting"));
    expect(result.current.overallStatus).toBe("reconnecting");

    act(() => result.current.setStatus("menuplan", "failed"));
    expect(result.current.overallStatus).toBe("failed");
  });

  test("unregister entfernt den Status wieder", () => {
    const {result} = renderHook(() => useRealtimeConnectionStatus());

    act(() => result.current.setStatus("event", "failed"));
    expect(result.current.overallStatus).toBe("failed");

    act(() => result.current.unregister("event"));
    expect(result.current.overallStatus).toBe("connected");
  });

  test("retryAll ruft alle registrierten reconnect()-Funktionen auf", () => {
    const {result} = renderHook(() => useRealtimeConnectionStatus());
    const reconnectEvent = jest.fn();
    const reconnectMenuplan = jest.fn();

    act(() => {
      result.current.register("event", reconnectEvent);
      result.current.register("menuplan", reconnectMenuplan);
    });

    act(() => result.current.retryAll());

    expect(reconnectEvent).toHaveBeenCalledTimes(1);
    expect(reconnectMenuplan).toHaveBeenCalledTimes(1);
  });

  test("retryAll ruft eine abgemeldete Subscription nicht mehr auf", () => {
    const {result} = renderHook(() => useRealtimeConnectionStatus());
    const reconnectEvent = jest.fn();

    act(() => {
      result.current.register("event", reconnectEvent);
      result.current.unregister("event");
      result.current.retryAll();
    });

    expect(reconnectEvent).not.toHaveBeenCalled();
  });
});
