import { useState } from "react";
import { loginUser, registerUser } from "../api";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  function persist(nextToken, nextUser) {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  async function login(email, password) {
    const { token, user } = await loginUser({ email, password });
    persist(token, user);
    return token;
  }

  async function register(name, email, password) {
    const { token, user } = await registerUser({ name, email, password });
    persist(token, user);
    return token;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
