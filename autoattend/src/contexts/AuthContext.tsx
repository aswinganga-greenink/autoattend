import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { User, UserRole } from "@/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user on mount if token exists
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await api.get('/users/me');
          setUser(res.data);
        } catch (error) {
          console.error("Failed to load user session", error);
          localStorage.removeItem('access_token');
        }
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    // 1. Get Token
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const tokenRes = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const token = tokenRes.data.access_token;
    localStorage.setItem('access_token', token);

    // 2. Fetch User Profile
    const userRes = await api.get('/users/me');
    setUser(userRes.data);
    return userRes.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
