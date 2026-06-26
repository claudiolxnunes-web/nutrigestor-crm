import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logLogin, logLogout, useAccessUnloadTracker } from "@/hooks/useAccessTracker";

type AuthCtx = { user: User | null; session: Session | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useAccessUnloadTracker();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setTimeout(() => {
        if (event === "SIGNED_IN" && s?.user) {
          void logLogin(s.user);
        }
        if (event === "SIGNED_OUT") {
          void logLogout();
        }
      }, 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) void logLogin(s.user);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={{ user, session, loading }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
