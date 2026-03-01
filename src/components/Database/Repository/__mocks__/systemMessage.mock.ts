/**
 * Mock-Daten für SystemMessageRepository-Tests.
 */
import {SystemMessageDomain, SystemMessageRow} from "../SystemMessageRepository";

const futureDate = new Date("2099-12-31T23:59:59.000Z");
const pastDate = new Date("2020-01-01T00:00:00.000Z");

/** Mock: Datenbank-Zeile (snake_case) wie sie aus Postgres kommt */
export const systemMessageRow: SystemMessageRow = {
  id: "a1b2c3d4-e5f6-7890-abcd-000000000001",
  title: "Wartung",
  text: "<p>Geplante Wartung am Samstag.</p>",
  type: "warning",
  valid_to: futureDate.toISOString(),
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

/** Mock: Domain-Objekt (camelCase) wie es in der App verwendet wird */
export const systemMessageDomain: SystemMessageDomain = {
  uid: "a1b2c3d4-e5f6-7890-abcd-000000000001",
  title: "Wartung",
  text: "<p>Geplante Wartung am Samstag.</p>",
  type: "warning",
  validTo: futureDate,
};

/** Mock: Zweite Meldung für findMany-Tests */
export const systemMessageRow2: SystemMessageRow = {
  id: "a1b2c3d4-e5f6-7890-abcd-000000000002",
  title: "Update verfügbar",
  text: "<p>Neues Update wurde eingespielt.</p>",
  type: "info",
  valid_to: futureDate.toISOString(),
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

/** Mock: Abgelaufene Meldung */
export const systemMessageRowExpired: SystemMessageRow = {
  id: "a1b2c3d4-e5f6-7890-abcd-000000000003",
  title: "Alte Meldung",
  text: "<p>Diese Meldung ist abgelaufen.</p>",
  type: "info",
  valid_to: pastDate.toISOString(),
  created_at: "2019-01-01T00:00:00Z",
  created_by: null,
  updated_at: "2019-01-01T00:00:00Z",
  updated_by: null,
};
