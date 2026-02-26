import AuthUser from "../components/Firebase/Authentication/authUser.class";
import {ValueObject} from "../components/Firebase/Db/firebase.db.super.class";
import Firebase from "../components/Firebase/firebase.class";
import {DatabaseService} from "../components/Database/DatabaseService";
import User from "../components/User/user.class";

export async function rebuildFile000AllUsers(firebase: Firebase, database: DatabaseService) {
  const allUsers: ValueObject = {};
  let counter = 0;

  const users = await User.getAllUsers({firebase: firebase});

  // Erstellen Sie ein Array von Promises für getPublicProfile
  const profilePromises = users.map(async (user) => {
    const result = await User.getPublicProfile({
      database: database,
      uid: user.uid,
    });
    return {
      uid: user.uid,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.firstName,
      email: user.email,
      memberId: result.memberId,
      memberSince: result.memberSince,
    };
  });

  // Warten Sie darauf, dass alle Promises im Array erfüllt sind
  const userProfiles = await Promise.all(profilePromises);

  userProfiles.forEach((user) => {
    counter++;
    allUsers[user.uid] = user;
    delete allUsers[user.uid].uid;
  });

  firebase.user.short
    .set({
      uids: [],
      value: allUsers,
      authUser: {} as AuthUser,
    })
    .catch((error) => console.error(error));

  return counter;
}
