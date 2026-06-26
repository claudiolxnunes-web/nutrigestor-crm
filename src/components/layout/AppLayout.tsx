import React, { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalSearch } from "./GlobalSearch";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export const PageHeader = React.memo(({ title, subtitle, actions }: PageHeaderProps) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6 premium-card p-5 md:p-10 mb-6 md:mb-10 overflow-hidden relative"
  >
    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
    <div className="relative z-10 space-y-1 md:space-y-2">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest text-slate-900 dark:text-white leading-tight md:leading-none">{title}</h1>
      <p className="text-muted-foreground text-sm md:text-base font-medium max-w-2xl">{subtitle}</p>
    </div>
     <div className="relative z-10 flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
      {actions ?? (
        <div className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 px-4 py-2 rounded-2xl font-bold text-[10px] uppercase tracking-widest border border-slate-200/50 dark:border-white/5">
          Módulo Ativo
        </div>
      )}
    </div>
  </motion.div>
));

PageHeader.displayName = "PageHeader";

const AppLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const isCampo = location.pathname === "/campo";

  return (
    <SidebarProvider defaultOpen={!isCampo}>
      <div className={cn(
        "min-h-screen flex w-full transition-colors duration-300",
        isCampo ? "bg-background" : "bg-[#f8fafc] dark:bg-background"
      )}>
        {!isCampo && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Header Desktop */}
          {!isCampo && (
            <header className="sticky top-0 z-30 hidden md:flex h-20 items-center justify-between px-10 bg-white/40 dark:bg-background/40 backdrop-blur-xl border-b border-white/20 dark:border-white/5">
              <div className="flex items-center gap-6">
                <SidebarTrigger className="h-10 w-10 hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm rounded-xl" />
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
                <GlobalSearch />
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-white/10" />
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] hidden lg:inline">Agro_RC &bull; CRM de Performance</span>
              </div>
              <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-400 hover:text-primary transition-all relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
                </Button>
                {user?.email && (
                  <div className="flex items-center gap-4 group cursor-pointer">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter mb-0.5">Sessão Ativa</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-200 transition-colors group-hover:text-primary" title={user.email}>{user.email.split('@')[0]}</p>
                    </div>
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary-glow p-[2px] shadow-lg group-hover:scale-105 transition-transform duration-300">
                      <div className="h-full w-full rounded-[14px] bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </header>
          )}

          {/* Header Mobile (Oculto no Campo pois o Campo tem header próprio) */}
          {!isCampo && (
            <header className="sticky top-0 z-30 h-16 flex items-center justify-between border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-background/40 backdrop-blur-xl px-6 md:hidden">
              <SidebarTrigger className="h-10 w-10 hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm rounded-xl" />
              <div className="font-black text-primary tracking-tightest text-xl absolute left-1/2 -translate-x-1/2">Agro_RC</div>
              <div className="h-10 w-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                <UserCircle className="h-6 w-6" />
              </div>
            </header>
          )}

          <main className={cn(
            "flex-1 overflow-x-hidden",
            isCampo ? "p-0" : "p-3 sm:p-4 md:p-8 lg:p-10"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(isCampo ? "w-full" : "max-w-7xl mx-auto")}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
