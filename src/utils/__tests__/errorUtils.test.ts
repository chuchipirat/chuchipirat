import {
  isRlsViolationError,
  isTransientNetworkError,
  toError,
} from "../errorUtils";

/* ===================================================================
// ======================== Test-Helfer ==============================
// =================================================================== */

/**
 * Setzt `navigator.onLine` für die Dauer eines Tests und stellt danach den
 * ursprünglichen Wert wieder her.
 *
 * @param online - Gewünschter `navigator.onLine`-Wert.
 * @returns Aufräumfunktion, die den Originalzustand wiederherstellt.
 */
const setNavigatorOnLine = (online: boolean): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(
    window.navigator,
    "onLine",
  );
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  return () => {
    if (original) {
      Object.defineProperty(window.navigator, "onLine", original);
    } else {
      delete (window.navigator as {onLine?: boolean}).onLine;
    }
  };
};

/* ===================================================================
// ======================== isTransientNetworkError ==================
// =================================================================== */

describe("isTransientNetworkError", () => {
  test("erkennt ein Supabase-Fehlerobjekt mit 'Failed to fetch' in message", () => {
    const supabaseError = {
      code: "",
      details: "TypeError: Failed to fetch\n    at https://chuchipirat.ch/x.js",
      hint: "",
      message: "TypeError: Failed to fetch (api.chuchipirat.ch)",
    };

    expect(isTransientNetworkError(supabaseError)).toBe(true);
  });

  test("erkennt ein Supabase-Fehlerobjekt, das den Netzfehler nur in details trägt", () => {
    const supabaseError = {
      code: "",
      details: "TypeError: Failed to fetch",
      hint: "",
      message: "",
    };

    expect(isTransientNetworkError(supabaseError)).toBe(true);
  });

  test("erkennt einen nativen TypeError('Failed to fetch')", () => {
    expect(isTransientNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  test("erkennt 'NetworkError when attempting to fetch resource'", () => {
    expect(
      isTransientNetworkError(
        new Error("NetworkError when attempting to fetch resource."),
      ),
    ).toBe(true);
  });

  test("liefert true, wenn navigator.onLine === false ist (auch bei unspezifischem Fehler)", () => {
    const restore = setNavigatorOnLine(false);
    try {
      expect(isTransientNetworkError(new Error("irgendein Fehler"))).toBe(true);
    } finally {
      restore();
    }
  });

  test("liefert false für einen normalen Anwendungsfehler", () => {
    expect(isTransientNetworkError(new Error("PGRST116"))).toBe(false);
    expect(isTransientNetworkError(new Error("boom"))).toBe(false);
  });

  test("liefert false für einen Supabase-Constraint-Fehler", () => {
    const constraintError = {
      code: "23505",
      details: "Key (id)=(default) already exists.",
      hint: "",
      message: "duplicate key value violates unique constraint",
    };

    expect(isTransientNetworkError(constraintError)).toBe(false);
  });

  test("liefert false für null, undefined und leere Werte", () => {
    expect(isTransientNetworkError(null)).toBe(false);
    expect(isTransientNetworkError(undefined)).toBe(false);
    expect(isTransientNetworkError({})).toBe(false);
    expect(isTransientNetworkError("")).toBe(false);
  });
});

/* ===================================================================
// ======================== toError =================================
// =================================================================== */

describe("toError", () => {
  test("gibt eine echte Error-Instanz unverändert zurück", () => {
    const original = new Error("original");

    expect(toError(original)).toBe(original);
  });

  test("verpackt ein Supabase-Fehlerobjekt in einen Error mit übernommener message", () => {
    const supabaseError = {
      code: "23505",
      details: "Key already exists.",
      hint: "",
      message: "duplicate key value violates unique constraint",
    };

    const result = toError(supabaseError);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("duplicate key value violates unique constraint");
    expect(result.cause).toBe(supabaseError);
    expect(result.name).toBe("SupabaseError");
  });

  test("nutzt einen Fallback-Text, wenn das Objekt keine message hat", () => {
    const result = toError({foo: "bar"});

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("Unbekannter Fehler (Objekt ohne message)");
    expect(result.name).toBe("Error");
  });

  test("verpackt einen String in einen Error", () => {
    const result = toError("kaputt");

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("kaputt");
  });

  test("liefert einen generischen Error für null/undefined", () => {
    expect(toError(null).message).toBe("Unbekannter Fehler");
    expect(toError(undefined).message).toBe("Unbekannter Fehler");
  });
});

/* ===================================================================
// ======================== isRlsViolationError =====================
// =================================================================== */

describe("isRlsViolationError", () => {
  test("erkennt ein Supabase-Objekt mit code 42501", () => {
    expect(
      isRlsViolationError({
        code: "42501",
        details: null,
        hint: null,
        message: 'new row violates row-level security policy for table "events"',
      }),
    ).toBe(true);
  });

  test("erkennt die Meldung auch ohne code", () => {
    expect(
      isRlsViolationError(
        new Error("new row violates row-level security policy for table \"events\""),
      ),
    ).toBe(true);
  });

  test("liefert false für andere Postgres-Fehler", () => {
    expect(
      isRlsViolationError({code: "23505", message: "duplicate key"}),
    ).toBe(false);
    expect(isRlsViolationError(new Error("Failed to fetch"))).toBe(false);
    expect(isRlsViolationError(null)).toBe(false);
  });
});
