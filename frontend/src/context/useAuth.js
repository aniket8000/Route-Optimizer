import { createContext, useContext } from "react";

// lives outside AuthContext.jsx so that file only exports a component -
// mixing the two breaks vite's fast refresh for the provider
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}
