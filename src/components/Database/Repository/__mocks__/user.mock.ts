/**
 * Mock-Daten für UserRepository-Tests.
 */
import {UserDomain, UserRow} from "../UserRepository";
import Role from "../../../../constants/roles";

/** Mock: Datenbank-Zeile (snake_case) wie sie aus Postgres kommt */
export const userRow: UserRow = {
  id: "abc12345678901234567",
  email: "test@chuchipirat.ch",
  first_name: "Test",
  last_name: "User",
  roles: ["basic"],
  last_login: "2026-02-20T10:00:00.000Z",
  no_logins: 5,
  display_name: "TestUser",
  member_since: "2025-01-15T00:00:00.000Z",
  member_id: 42,
  motto: "Testing is caring",
  picture_src_small: "https://example.com/small.jpg",
  picture_src_normal: "https://example.com/normal.jpg",
  picture_src_full: "https://example.com/full.jpg",
  created_at: "2025-01-15T00:00:00.000Z",
  last_change_at: "2026-02-20T10:00:00.000Z",
};

/** Mock: Domain-Objekt (camelCase) wie es in der App verwendet wird */
export const userDomain: UserDomain = {
  uid: "abc12345678901234567",
  email: "test@chuchipirat.ch",
  firstName: "Test",
  lastName: "User",
  roles: [Role.basic],
  lastLogin: new Date("2026-02-20T10:00:00.000Z"),
  noLogins: 5,
  displayName: "TestUser",
  memberSince: new Date("2025-01-15T00:00:00.000Z"),
  memberId: 42,
  motto: "Testing is caring",
  pictureSrc: {
    smallSize: "https://example.com/small.jpg",
    normalSize: "https://example.com/normal.jpg",
    fullSize: "https://example.com/full.jpg",
  },
};

/** Mock: Zweiter User für findMany-Tests */
export const userRow2: UserRow = {
  id: "def98765432109876543",
  email: "admin@chuchipirat.ch",
  first_name: "Admin",
  last_name: "Boss",
  roles: ["admin", "basic"],
  last_login: "2026-02-25T08:00:00.000Z",
  no_logins: 100,
  display_name: "AdminBoss",
  member_since: "2024-06-01T00:00:00.000Z",
  member_id: 1,
  motto: "I am the boss",
  picture_src_small: "",
  picture_src_normal: "",
  picture_src_full: "",
  created_at: "2024-06-01T00:00:00.000Z",
  last_change_at: "2026-02-25T08:00:00.000Z",
};

/** Mock: user_profiles View Zeile */
export const userProfileRow = {
  id: "abc12345678901234567",
  display_name: "TestUser",
  member_since: "2025-01-15T00:00:00.000Z",
  member_id: 42,
  motto: "Testing is caring",
  picture_src_small: "https://example.com/small.jpg",
  picture_src_normal: "https://example.com/normal.jpg",
  picture_src_full: "https://example.com/full.jpg",
};
