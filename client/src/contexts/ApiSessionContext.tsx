import { createContext, useContext, useMemo, useState } from "react";
import { Session, SnappyApi } from "@/lib/api";

const STORAGE_KEY = "imsnappy.session.v1";
type ApiSessionContextValue = {
  api: SnappyApi;
  session: Session | null;
  saveSession: (session: Session) => void;
  clearSession: () => void;
};

const ApiSessionContext = createContext<ApiSessionContextValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function ApiSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);
  const api = useMemo(
    () => new SnappyApi(import.meta.env.VITE_API_BASE_URL ?? "", () => session),
    [session],
  );
  const value = useMemo<ApiSessionContextValue>(
    () => ({
      api,
      session,
      saveSession: (nextSession) => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      },
      clearSession: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [api, session],
  );
  return <ApiSessionContext.Provider value={value}>{children}</ApiSessionContext.Provider>;
}

export function useApiSession() {
  const context = useContext(ApiSessionContext);
  if (!context) throw new Error("useApiSession must be used within ApiSessionProvider.");
  return context;
}
