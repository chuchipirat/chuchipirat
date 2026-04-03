/**
 * Unit-Tests für User Service-Klasse.
 *
 * Testet alle statischen Methoden der User-Klasse. Die Abhängigkeiten
 * (DatabaseService, Firebase) werden vollständig gemockt.
 */
import {User, UserFullProfile} from "../user.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {Role} from "../../../constants/roles";
import {UserPublicProfile} from "../user.public.profile.class";
import {SortOrder} from "../../Firebase/Db/firebase.db.super.class";

/* ------------------------------------------
// imageResize Mock (Canvas ist in jsdom nicht verfügbar)
// ------------------------------------------ */
jest.mock("../../Shared/imageResize", () => ({
  resizeImage: jest.fn().mockResolvedValue(new Blob(["resized"], {type: "image/jpeg"})),
}));

/* ------------------------------------------
// Text-Konstanten (Originalwerte verwenden)
// ------------------------------------------ */
const TEXT_NO_USER_WITH_THIS_EMAIL =
  "Wir kennen keine Person mit dieser E-Mail-Adresse. Hat die Person einen Account?";
const TEXT_USER_PROFILE_ERROR_DISPLAYNAME_MISSING =
  "Bitte gib einen Anzeigename an.";

/* ------------------------------------------
// Mock-Daten
// ------------------------------------------ */
const createMockAuthUser = (overrides?: Partial<AuthUser>): AuthUser => {
  const authUser = new AuthUser();
  authUser.uid = "user-123";
  authUser.email = "test@chuchipirat.ch";
  authUser.firstName = "Test";
  authUser.lastName = "User";
  Object.assign(authUser, overrides);
  return authUser;
};

const mockDatabase = {
  users: {
    upsert: jest.fn(),
    findOverview: jest.fn(),
    registerSignIn: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findPublicProfile: jest.fn(),
    findFullProfile: jest.fn(),
    patch: jest.fn(),
  },
  storage: {
    users: {
      upload: jest.fn().mockResolvedValue({
        path: "users/user-123.jpg",
        publicUrl: "https://cdn/users/user-123.jpg",
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  },
};

const mockFirebase = {
  analytics: {},
  user: {
    readCollection: jest.fn(),
    public: {profile: {incrementField: jest.fn()}},
  },
  fileStore: {
    users: {
      uploadFile: jest.fn(),
      getPictureVariants: jest.fn(),
      deleteFile: jest.fn(),
    },
  },
};

/* ------------------------------------------
// Setup
// ------------------------------------------ */
beforeEach(() => {
  jest.clearAllMocks();
});

/* =====================================================================
// constructor
// ===================================================================== */
describe("constructor", () => {
  test("Standardwerte korrekt setzen", () => {
    const user = new User();

    expect(user.uid).toBe("");
    expect(user.firstName).toBe("");
    expect(user.lastName).toBe("");
    expect(user.email).toBe("");
    expect(user.noLogins).toBe(0);
    expect(user.roles).toEqual([]);
  });
});

/* =====================================================================
// factory()
// ===================================================================== */
describe("factory()", () => {
  test("User-Instanz aus bestehendem Objekt erzeugen", () => {
    const source = new User();
    source.uid = "abc";
    source.firstName = "Max";
    source.lastName = "Muster";
    source.email = "max@test.ch";
    source.noLogins = 42;

    const result = User.factory(source);

    expect(result).toBeInstanceOf(User);
    expect(result.uid).toBe("abc");
    expect(result.firstName).toBe("Max");
    expect(result.lastName).toBe("Muster");
    expect(result.email).toBe("max@test.ch");
    expect(result.noLogins).toBe(42);
  });
});

/* =====================================================================
// createUser()
// ===================================================================== */
describe("createUser()", () => {
  test("Upsert mit korrekten Werten aufrufen", async () => {
    mockDatabase.users.upsert.mockResolvedValue(undefined);

    await User.createUser({
      database: mockDatabase as any,
      uid: "new-user",
      firstName: "Anna",
      lastName: "Test",
      email: "ANNA@Test.CH",
    });

    expect(mockDatabase.users.upsert).toHaveBeenCalledWith({
      id: "new-user",
      value: expect.objectContaining({
        uid: "new-user",
        firstName: "Anna",
        lastName: "Test",
        email: "anna@test.ch",
        noLogins: 0,
        roles: [Role.basic],
        displayName: "Anna Test",
        memberId: 0,
        motto: "",
      }),
      authUser: expect.anything(),
    });
  });

  test("Fehler propagieren", async () => {
    mockDatabase.users.upsert.mockRejectedValue(new Error("DB error"));

    await expect(
      User.createUser({
        database: mockDatabase as any,
        uid: "x",
        firstName: "A",
        lastName: "B",
        email: "a@b.ch",
      })
    ).rejects.toThrow("DB error");
  });
});

/* =====================================================================
// getAllUsers()
// ===================================================================== */
describe("getAllUsers()", () => {
  test("Firebase readCollection aufrufen und Ergebnis zurückgeben", async () => {
    const mockUsers = [
      {uid: "1", firstName: "A"},
      {uid: "2", firstName: "B"},
    ];
    mockFirebase.user.readCollection.mockResolvedValue(mockUsers);

    const result = await User.getAllUsers({firebase: mockFirebase as any});

    expect(mockFirebase.user.readCollection).toHaveBeenCalledWith({
      uids: [""],
      orderBy: {field: "firstName", sortOrder: SortOrder.desc},
      ignoreCache: true,
    });
    expect(result).toEqual(mockUsers);
  });

  test("Fehler propagieren", async () => {
    mockFirebase.user.readCollection.mockRejectedValue(
      new Error("Firebase error")
    );

    await expect(
      User.getAllUsers({firebase: mockFirebase as any})
    ).rejects.toThrow("Firebase error");
  });
});

/* =====================================================================
// getUsersOverview()
// ===================================================================== */
describe("getUsersOverview()", () => {
  test("An findOverview() delegieren", async () => {
    const overview = [{uid: "1", firstName: "Test", lastName: "User"}];
    mockDatabase.users.findOverview.mockResolvedValue(overview);

    const result = await User.getUsersOverview({
      database: mockDatabase as any,
    });

    expect(mockDatabase.users.findOverview).toHaveBeenCalled();
    expect(result).toEqual(overview);
  });
});

/* =====================================================================
// registerSignIn()
// ===================================================================== */
describe("registerSignIn()", () => {
  test("An registerSignIn() delegieren", async () => {
    mockDatabase.users.registerSignIn.mockResolvedValue(undefined);
    const authUser = createMockAuthUser();

    await User.registerSignIn({
      database: mockDatabase as any,
      authUser: authUser,
    });

    expect(mockDatabase.users.registerSignIn).toHaveBeenCalledWith("user-123");
  });

  test("Fehler propagieren", async () => {
    mockDatabase.users.registerSignIn.mockRejectedValue(
      new Error("register error")
    );
    const authUser = createMockAuthUser();

    await expect(
      User.registerSignIn({
        database: mockDatabase as any,
        authUser: authUser,
      })
    ).rejects.toThrow("register error");
  });
});

/* =====================================================================
// getUidByEmail()
// ===================================================================== */
describe("getUidByEmail()", () => {
  test("UID zurückgeben wenn gefunden", async () => {
    mockDatabase.users.findByEmail.mockResolvedValue("found-uid");

    const result = await User.getUidByEmail({
      database: mockDatabase as any,
      email: "test@test.ch",
    });

    expect(result).toBe("found-uid");
  });

  test("eventId an findByEmail weiterleiten", async () => {
    mockDatabase.users.findByEmail.mockResolvedValue("found-uid");

    await User.getUidByEmail({
      database: mockDatabase as any,
      email: "test@test.ch",
      eventId: "event-abc",
    });

    expect(mockDatabase.users.findByEmail).toHaveBeenCalledWith(
      "test@test.ch",
      "event-abc",
    );
  });

  test("Fehler werfen wenn nicht gefunden (null)", async () => {
    mockDatabase.users.findByEmail.mockResolvedValue(null);

    await expect(
      User.getUidByEmail({
        database: mockDatabase as any,
        email: "unknown@test.ch",
      })
    ).rejects.toThrow(TEXT_NO_USER_WITH_THIS_EMAIL);
  });

  test("DB-Fehler propagieren", async () => {
    mockDatabase.users.findByEmail.mockRejectedValue(new Error("DB error"));

    await expect(
      User.getUidByEmail({
        database: mockDatabase as any,
        email: "fail@test.ch",
      })
    ).rejects.toThrow("DB error");
  });
});

/* =====================================================================
// getUser()
// ===================================================================== */
describe("getUser()", () => {
  test("User korrekt mappen", async () => {
    mockDatabase.users.findById.mockResolvedValue({
      uid: "u1",
      firstName: "Max",
      lastName: "Muster",
      email: "max@test.ch",
      noLogins: 10,
      roles: [Role.basic],
    });

    const result = await User.getUser({
      database: mockDatabase as any,
      uid: "u1",
    });

    expect(result).toBeInstanceOf(User);
    expect(result.uid).toBe("u1");
    expect(result.firstName).toBe("Max");
    expect(result.lastName).toBe("Muster");
    expect(result.email).toBe("max@test.ch");
    expect(result.noLogins).toBe(10);
    expect(result.roles).toEqual([Role.basic]);
  });

  test("Fehler werfen wenn nicht gefunden", async () => {
    mockDatabase.users.findById.mockResolvedValue(null);

    await expect(
      User.getUser({
        database: mockDatabase as any,
        uid: "nonexistent",
      })
    ).rejects.toThrow("User not found: nonexistent");
  });
});

/* =====================================================================
// getPublicProfile()
// ===================================================================== */
describe("getPublicProfile()", () => {
  test("An findPublicProfile() delegieren", async () => {
    const mockProfile = new UserPublicProfile();
    mockProfile.uid = "u1";
    mockProfile.displayName = "TestUser";
    mockDatabase.users.findPublicProfile.mockResolvedValue(mockProfile);

    const result = await User.getPublicProfile({
      database: mockDatabase as any,
      uid: "u1",
    });

    expect(mockDatabase.users.findPublicProfile).toHaveBeenCalledWith("u1");
    expect(result.displayName).toBe("TestUser");
  });
});

/* =====================================================================
// getFullProfile()
// ===================================================================== */
describe("getFullProfile()", () => {
  test("createdAt korrekt auf memberSince mappen", async () => {
    const createdAt = new Date("2025-01-15T00:00:00.000Z");
    mockDatabase.users.findFullProfile.mockResolvedValue({
      uid: "u1",
      firstName: "Max",
      lastName: "Muster",
      email: "max@test.ch",
      noLogins: 5,
      roles: [Role.basic],
      displayName: "MaxM",
      createdAt: createdAt,
      memberId: 42,
      motto: "Test",
      pictureSrc: "",
      stats: {
        noComments: 0,
        noRatings: 0,
        noEvents: 0,
        noRecipesPublic: 0,
        noRecipesPrivate: 0,
        noRecipesVariants: 0,
        noFoundBugs: 0,
      },
    });

    const result = await User.getFullProfile({
      database: mockDatabase as any,
      uid: "u1",
    });

    expect(result.memberSince).toEqual(createdAt);
    expect(result.uid).toBe("u1");
    expect(result.displayName).toBe("MaxM");
  });

  test("Fehler propagieren wenn User nicht gefunden", async () => {
    mockDatabase.users.findFullProfile.mockRejectedValue(
      new Error("User not found: missing")
    );

    await expect(
      User.getFullProfile({
        database: mockDatabase as any,
        uid: "missing",
      })
    ).rejects.toThrow("User not found: missing");
  });
});

/* =====================================================================
// checkUserProfileData()
// ===================================================================== */
describe("checkUserProfileData()", () => {
  test("Kein Fehler wenn displayName vorhanden", () => {
    const profile = {displayName: "Test", firstName: ""} as UserFullProfile;

    expect(() => User.checkUserProfileData(profile)).not.toThrow();
  });

  test("Kein Fehler wenn firstName als Fallback vorhanden", () => {
    const profile = {displayName: "", firstName: "Max"} as UserFullProfile;

    expect(() => User.checkUserProfileData(profile)).not.toThrow();
  });

  test("Fehler wenn weder displayName noch firstName", () => {
    const profile = {displayName: "", firstName: ""} as UserFullProfile;

    expect(() => User.checkUserProfileData(profile)).toThrow(
      TEXT_USER_PROFILE_ERROR_DISPLAYNAME_MISSING
    );
  });
});

/* =====================================================================
// saveFullProfile()
// ===================================================================== */
describe("saveFullProfile()", () => {
  const authUser = createMockAuthUser();
  const baseProfile = {
    uid: "u1",
    firstName: "Max",
    lastName: "Muster",
    displayName: "MaxM",
    email: "max@test.ch",
    motto: "Old motto",
    pictureSrc: "https://cdn/old-pic.jpg",
    noLogins: 5,
    roles: [Role.basic],
  } as UserFullProfile;

  beforeEach(() => {
    mockDatabase.users.patch.mockResolvedValue(undefined);
  });

  test("Profil ohne Bild speichern", async () => {
    await User.saveFullProfile({
      firebase: mockFirebase as any,
      database: mockDatabase as any,
      userProfile: {...baseProfile},
      authUser: authUser,
    });

    expect(mockDatabase.users.patch).toHaveBeenCalledWith({
      id: "u1",
      fields: expect.objectContaining({
        first_name: "Max",
        last_name: "Muster",
        display_name: "MaxM",
        motto: "Old motto",
      }),
      authUser: authUser,
    });
  });

  test("Profil mit Bild speichern", async () => {
    const mockFile = new File(["data"], "photo.jpg", {type: "image/jpeg"});

    // Storage mock für delete und upload
    mockDatabase.storage.users.remove.mockResolvedValue(undefined);
    mockDatabase.storage.users.upload.mockResolvedValue({
      path: "users/u1.jpg",
      publicUrl: "https://cdn/users/u1.jpg",
    });

    await User.saveFullProfile({
      firebase: mockFirebase as any,
      database: mockDatabase as any,
      userProfile: {...baseProfile},
      authUser: authUser,
      localPicture: mockFile,
    });

    expect(mockDatabase.storage.users.upload).toHaveBeenCalled();
    expect(mockDatabase.users.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          picture_src: "https://cdn/users/u1.jpg",
        }),
      })
    );
  });

  test("DisplayName-Änderung wird direkt gespeichert (keine Cloud Function)", async () => {
    await User.saveFullProfile({
      firebase: mockFirebase as any,
      database: mockDatabase as any,
      userProfile: {...baseProfile, displayName: "NeuerName"},
      authUser: authUser,
    });

    expect(mockDatabase.users.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          display_name: "NeuerName",
        }),
      })
    );
  });

  test("Motto-Änderung wird direkt gespeichert (keine Cloud Function)", async () => {
    await User.saveFullProfile({
      firebase: mockFirebase as any,
      database: mockDatabase as any,
      userProfile: {...baseProfile, motto: "New motto"},
      authUser: authUser,
    });

    expect(mockDatabase.users.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          motto: "New motto",
        }),
      })
    );
  });
});

/* =====================================================================
// uploadPicture()
// ===================================================================== */
describe("uploadPicture()", () => {
  test("Bild hochladen via Supabase Storage", async () => {
    const authUser = createMockAuthUser();
    const mockFile = new File(["data"], "img.jpg", {type: "image/jpeg"});

    mockDatabase.storage.users.upload.mockResolvedValue({
      path: "users/user-123.jpg",
      publicUrl: "https://cdn/users/user-123.jpg",
    });

    const result = await User.uploadPicture({
      database: mockDatabase as any,
      file: mockFile,
      authUser: authUser,
    });

    expect(mockDatabase.storage.users.upload).toHaveBeenCalledWith(
      "user-123.jpg",
      expect.any(Blob),
      "image/jpeg"
    );
    expect(result).toBe("https://cdn/users/user-123.jpg");
  });
});

/* =====================================================================
// deletePicture()
// ===================================================================== */
describe("deletePicture()", () => {
  test("Bild aus Supabase Storage löschen und DB patchen", async () => {
    const authUser = createMockAuthUser();
    mockDatabase.storage.users.remove.mockResolvedValue(undefined);
    mockDatabase.users.patch.mockResolvedValue(undefined);

    await User.deletePicture({
      firebase: mockFirebase as any,
      database: mockDatabase as any,
      authUser: authUser,
    });

    // Bild aus Supabase Storage löschen
    expect(mockDatabase.storage.users.remove).toHaveBeenCalledWith(
      "user-123.jpg"
    );

    // DB-Patch für leere Bild-URL
    expect(mockDatabase.users.patch).toHaveBeenCalledWith({
      id: "user-123",
      fields: {
        picture_src: "",
      },
      authUser: authUser,
    });
  });
});

/* =====================================================================
// updateRoles()
// ===================================================================== */
describe("updateRoles()", () => {
  test("Rollen in DB patchen", async () => {
    const authUser = createMockAuthUser();
    mockDatabase.users.patch.mockResolvedValue(undefined);

    await User.updateRoles({
      firebase: mockFirebase as any,
      database: mockDatabase as any,
      userUid: "target-user",
      newRoles: [Role.basic, Role.admin],
      authUser: authUser,
    });

    expect(mockDatabase.users.patch).toHaveBeenCalledWith({
      id: "target-user",
      fields: {roles: [Role.basic, Role.admin]},
      authUser: authUser,
    });
  });
});

/* =====================================================================
// updateStats()
// ===================================================================== */
describe("updateStats()", () => {
  test("Supabase incrementFoundBugs aufrufen", async () => {
    const mockIncrementFoundBugs = jest.fn().mockResolvedValue(undefined);
    const dbWithAdmin = {
      ...mockDatabase,
      admin: {
        users: {
          ...mockDatabase.users,
          incrementFoundBugs: mockIncrementFoundBugs,
        },
      },
    };

    await User.updateStats({
      database: dbWithAdmin as any,
      userUid: "u1",
      statsValue: 1,
    });

    expect(mockIncrementFoundBugs).toHaveBeenCalledWith("u1", 1);
  });

  test("Verwendet database.users wenn kein admin-Client vorhanden", async () => {
    const mockIncrementFoundBugs = jest.fn().mockResolvedValue(undefined);
    const dbWithoutAdmin = {
      ...mockDatabase,
      admin: null,
      users: {
        ...mockDatabase.users,
        incrementFoundBugs: mockIncrementFoundBugs,
      },
    };

    await User.updateStats({
      database: dbWithoutAdmin as any,
      userUid: "u1",
      statsValue: -1,
    });

    expect(mockIncrementFoundBugs).toHaveBeenCalledWith("u1", -1);
  });
});
