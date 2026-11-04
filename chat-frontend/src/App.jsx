import { useEffect, useState } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { gql, Q } from "./api.js";
import Header from "./components/Header.jsx";
import LoginDialog from "./components/LoginDialog.jsx";
import LockedView from "./components/LockedView.jsx";
import Workspace from "./components/Workspace.jsx";
import { toaster } from "./toaster.jsx";

const STORAGE_KEY = "chat.user";

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveUser(user) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

export default function App() {
  const [user, setUser] = useState(loadUser);
  const [loginOpen, setLoginOpen] = useState(false);

  const login = (u) => {
    setUser(u);
    saveUser(u);
    setLoginOpen(false);
  };

  const logout = () => {
    setUser(null);
    saveUser(null);
  };

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    gql(Q.user, { id: user.id })
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          logout();
          toaster.create({ title: "Tu usuario ya no existe", description: "Inicia sesión de nuevo.", type: "warning" });
        } else if (data.user.displayName !== user.displayName) {
          login(data.user);
        }
      })
      .catch(() => {
        /* sin conexión: se mantiene la sesión guardada */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Flex direction="column" h="100dvh" bg="bg">
      <Header user={user} onLoginClick={() => setLoginOpen(true)} onLogout={logout} />
      <Box flex="1" minH="0" display="flex">
        {user ? <Workspace user={user} /> : <LockedView onLoginClick={() => setLoginOpen(true)} />}
      </Box>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={login} />
    </Flex>
  );
}
