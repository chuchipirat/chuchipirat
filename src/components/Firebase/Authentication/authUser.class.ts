import Role from "../../../constants/roles";

export interface AuthUserPublicProfile {
  displayName: string;
  motto: string;
  pictureSrc: string;
}

export class AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  roles: Role[];
  publicProfile: AuthUserPublicProfile;
  constructor() {
    this.uid = "";
    this.email = "";
    this.emailVerified = false;
    this.firstName = "";
    this.lastName = "";
    this.roles = [];
    this.publicProfile = {
      displayName: "",
      motto: "",
      pictureSrc: "",
    };
  }
}

export default AuthUser;
