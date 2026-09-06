import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { AUTH_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const stored = localStorage.getItem("token");
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${AUTH_API}/me`, { headers: { Authorization: `Bearer ${stored}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Session expired.");
        if (!cancelled) {
          setToken(stored);
          setUser(data.user);
        }
      } catch {
        localStorage.removeItem("token");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${AUTH_API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid email or password.");
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const signup = useCallback(async (fullName, email, password) => {
    const res = await fetch(`${AUTH_API}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not create your account.");
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  const updateFullName = useCallback(async (fullName) => {
    const res = await apiFetch(`${AUTH_API}/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not update your name.");
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, updateFullName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
