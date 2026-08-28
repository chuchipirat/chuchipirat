import AuthUser from "../authUser.class";

test("Authuser.constructor()", () => {
  const authUser = new AuthUser();

  expect(authUser).toBeDefined();
  expect(authUser.emailVerified).toBeFalsy();
  expect(authUser.roles.length).toBe(0);
});
