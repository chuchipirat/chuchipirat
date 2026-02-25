import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";

import {
  SIGN_IN as ROUTE_SIGN_IN,
  NO_AUTH as ROUTE_NO_AUTH,
} from "../../constants/routes";

export const AuthUserContext = React.createContext<AuthUser | null>(null);

/* ===================================================================
// ============================== Hooks ==============================
// =================================================================== */
export const useAuthUser = (): AuthUser | null => {
  return React.useContext(AuthUserContext);
};

/* ===================================================================
// ========================= AuthUserProvider ========================
// =================================================================== */
export const AuthUserProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const firebase = useFirebase();
  const database = useDatabase();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const listener = firebase.onAuthUserListener((authUser) => {
      setAuthUser(authUser);
    }, database);

    return () => {
      listener(); // Aufräumarbeiten beim Komponentenabbau
    };
  }, [firebase.auth]);

  return (
    <AuthUserContext.Provider value={authUser}>
      {children}
    </AuthUserContext.Provider>
  );
};

/* ===================================================================
// ======================= AuthorizationGuard ========================
// =================================================================== */
interface AuthorizationGuardProps {
  condition: (authUser: AuthUser | null) => boolean;
  children: React.ReactNode;
}
export const AuthorizationGuard: React.FC<AuthorizationGuardProps> = ({
  condition,
  children,
}) => {
  const authUser = useAuthUser();
  const firebase = useFirebase();
  const database = useDatabase();
  const navigate = useNavigate();

  useEffect(() => {
    const listener = firebase.onAuthUserListener((authUser) => {
      if (authUser === null) {
        navigate(ROUTE_SIGN_IN);
      } else if (!condition(authUser)) {
        navigate(ROUTE_NO_AUTH);
      }
    }, database);

    return () => {
      listener(); // Aufräumarbeiten beim Komponentenabbau
    };
  }, [firebase.auth, navigate]);

  return condition(authUser) ? <>{children}</> : null;
};
