import Role from "../../../../constants/roles";
import {AuthUser} from "../authUser.class";

export const authUser: AuthUser = {
  uid: "RvLIR9NDGOWPwos8PrSZVgfIZvj9",
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
