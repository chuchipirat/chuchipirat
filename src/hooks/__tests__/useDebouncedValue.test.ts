/**
 * Unit-Tests für den useDebouncedValue-Hook.
 *
 * Testet, ob der Wert erst nach Ablauf der Verzögerung übernommen
 * wird und Zwischenwerte bei schnellen Änderungen verworfen werden.
 */
import {renderHook, act} from "@testing-library/react";

import {useDebouncedValue} from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("gibt initial den Ausgangswert zurück", () => {
    const {result} = renderHook(() => useDebouncedValue("a", 500));

    expect(result.current).toBe("a");
  });

  test("übernimmt den neuen Wert erst nach Ablauf der Verzögerung", () => {
    const {result, rerender} = renderHook(
      ({value}) => useDebouncedValue(value, 500),
      {initialProps: {value: "a"}},
    );

    rerender({value: "ab"});
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  test("verwirft Zwischenwerte bei schnell aufeinanderfolgenden Änderungen", () => {
    const {result, rerender} = renderHook(
      ({value}) => useDebouncedValue(value, 500),
      {initialProps: {value: "a"}},
    );

    rerender({value: "ab"});
    act(() => {
      jest.advanceTimersByTime(200);
    });
    rerender({value: "abc"});
    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe("abc");
  });
});
