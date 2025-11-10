import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "./auth";

export type ThemePreference = "light" | "dark" | "system";

interface ThemePreferencesContextValue {
  preference: ThemePreference;
  setPreference: (theme: ThemePreference) => Promise<void>;
  loading: boolean;
  lastSyncedAt: string | null;
}

const ThemePreferencesContext = createContext<ThemePreferencesContextValue | undefined>(undefined);

const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/v1`;

export function ThemePreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Ensure local preference stays in sync with next-themes current theme
  useEffect(() => {
    if (!token || !user) {
      // For guests, rely on next-themes local preference
      if (theme === "light" || theme === "dark" || theme === "system") {
        setPreferenceState(theme);
      } else if (resolvedTheme === "light" || resolvedTheme === "dark") {
        setPreferenceState(resolvedTheme);
      }
      return;
    }
  }, [token, user, theme, resolvedTheme]);

  useEffect(() => {
    if (!user || !token) {
      setLastSyncedAt(null);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchPreference = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/settings/theme`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch theme preference (${response.status})`);
        }

        const data = await response.json();
        if (isCancelled) return;

        const nextTheme = (data.theme ?? "system") as ThemePreference;
        setPreferenceState(nextTheme);
        setLastSyncedAt(data.lastUpdated ?? null);
        setTheme(nextTheme);
      } catch (error) {
        if ((error as any)?.name === "AbortError") return;
        console.error("Failed to load theme preference:", error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchPreference();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [user, token, setTheme]);

  const persistPreference = useCallback(
    async (nextTheme: ThemePreference) => {
      setPreferenceState(nextTheme);
      setTheme(nextTheme);

      try {
        const response = await fetch(`${API_BASE_URL}/settings/theme`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ theme: nextTheme }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.warn(`Theme preference persisted locally only (${response.status})`);
          setLastSyncedAt(null);
          return data;
        }

        if (data?.persisted === false) {
          console.warn('Theme preference persisted locally only (server-side persistence unavailable).');
          setLastSyncedAt(null);
        } else {
          setLastSyncedAt(data?.lastUpdated ?? new Date().toISOString());
        }
        return data;
      } catch (error) {
        console.warn("Failed to save theme preference remotely:", error);
        setLastSyncedAt(null);
        return;
      }
    },
    [token, user, setTheme]
  );

  const value = useMemo<ThemePreferencesContextValue>(
    () => ({
      preference,
      setPreference: persistPreference,
      loading,
      lastSyncedAt,
    }),
    [preference, persistPreference, loading, lastSyncedAt]
  );

  return <ThemePreferencesContext.Provider value={value}>{children}</ThemePreferencesContext.Provider>;
}

export function useThemePreferences() {
  const context = useContext(ThemePreferencesContext);
  if (context === undefined) {
    throw new Error("useThemePreferences must be used within a ThemePreferencesProvider");
  }
  return context;
}

