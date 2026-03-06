/**
 * Mock-Daten für UserRepository-Tests.
 */
import {UserDomain, UserRow} from "../UserRepository";
import Role from "../../../../constants/roles";

/** Mock: Datenbank-Zeile (snake_case) wie sie aus Postgres kommt */
export const userRow: UserRow = {
  id: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
  auth_uid: null,
  email: "test@chuchipirat.ch",
  first_name: "Test",
  last_name: "User",
  roles: ["basic"],
  no_logins: 5,
  no_found_bugs: 3,
  display_name: "TestUser",
  member_id: 42,
  motto: "Testing is caring",
  picture_src: "https://example.com/profile.jpg",
  created_at: "2025-01-15T00:00:00.000Z",
  updated_at: "2026-02-20T10:00:00.000Z",
};

/** Mock: Domain-Objekt (camelCase) wie es in der App verwendet wird */
export const userDomain: UserDomain = {
  uid: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
  email: "test@chuchipirat.ch",
  firstName: "Test",
  lastName: "User",
  roles: [Role.basic],
  noLogins: 5,
  noFoundBugs: 3,
  displayName: "TestUser",
  memberId: 42,
  motto: "Testing is caring",
  pictureSrc: "https://example.com/profile.jpg",
};

/** Mock: Zweiter User für findMany-Tests */
export const userRow2: UserRow = {
  id: "X8kLmN3pQrStUvWxYz1234abcde",
  auth_uid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  email: "admin@chuchipirat.ch",
  first_name: "Admin",
  last_name: "Boss",
  roles: ["admin", "basic"],
  no_logins: 100,
  no_found_bugs: 0,
  display_name: "AdminBoss",
  member_id: 1,
  motto: "I am the boss",
  picture_src: "",
  created_at: "2024-06-01T00:00:00.000Z",
  updated_at: "2026-02-25T08:00:00.000Z",
};

/** Mock: user_profiles View Zeile */
export const userProfileRow = {
  id: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
  display_name: "TestUser",
  created_at: "2025-01-15T00:00:00.000Z",
  member_id: 42,
  motto: "Testing is caring",
  picture_src: "https://example.com/profile.jpg",
};
