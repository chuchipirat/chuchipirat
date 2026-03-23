import {Role} from "../../../../constants/roles";
import {AuthUser} from "../authUser.class";

export const authUser: AuthUser = {
  uid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  email: "test@chuchipirat.ch",
  emailVerified: true,
  firstName: "Test",
  lastName: "Jest",
  roles: [Role.basic],
  publicProfile: {
    displayName: "Test User",
    motto: "🤪 ich teste mich dumm und dämlich...",
    pictureSrc: "https://jestjs.io/img/opengraph.png",
  },
};

export default authUser;
