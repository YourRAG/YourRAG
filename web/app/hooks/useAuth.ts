"use client";

import { useState, useEffect, useCallback } from "react";
import { User, AuthState } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface BanInfo {
  banned: boolean;
  reason: string | null;
}

export function useAuth(): AuthState & {
  login: (provider?: string) => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  banInfo: BanInfo | null;
  clearBanInfo: () => void;
  providers: string[];
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [providers, setProviders] = useState<string[]>([]);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/providers`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers);
      }
    } catch (error) {
      console.error("Failed to fetch auth providers:", error);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setBanInfo(null);
      } else if (response.status === 403) {
        // User is banned
        const data = await response.json().catch(() => ({}));
        setUser(null);
        setBanInfo({
          banned: true,
          reason: data.detail || "Your account has been banned",
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    fetchProviders();
  }, [fetchUser, fetchProviders]);

  const login = (provider: string = "github") => {
    window.location.href = `${API_URL}/auth/${provider}`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setBanInfo(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const clearBanInfo = useCallback(() => {
    setBanInfo(null);
  }, []);

  return {
    user,
    loading,
    login,
    logout,
    refetch: fetchUser,
    banInfo,
    clearBanInfo,
    providers,
  };
}