import { LayoutDashboard, Users, Building2, Package, Target, CalendarDays, ClipboardList, Upload, BarChart3, LogOut, Trophy, UserCircle, Smartphone, Shield, PackageOpen, Kanban, X, Bot, Mail, Brain } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
 import { useRole } from "@/hooks/useRole";
 import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";

type Item = { title: string; url: string; icon: any; gestorOnly?: boolean; superOnly?: boolean };
const items: Item[] = [
  { title: "Super Admin", url: "/super-admin", icon: Shield, superOnly: true },
  { title: "Dashboard", url: "/", icon: LayoutDashboard, gestorOnly: true },
  { title: "Meu Painel", url: "/meu-painel", icon: UserCircle },
  { title: "Meu Trabalho", url: "/campo", icon: Smartphone },
  { title: "Representantes", url: "/representantes", icon: Users, gestorOnly: true },
   { title: "Clientes", url: "/clientes", icon: Building2 },
   { title: "Leads", url: "/leads", icon: Target },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Metas", url: "/metas", icon: Trophy, gestorOnly: true },
  { title: "Visitas", url: "/visitas", icon: CalendarDays },
  { title: "Oportunidades", url: "/oportunidades", icon: Kanban },
  { title: "Gestão Gerencial", url: "/gerencial", icon: BarChart3, gestorOnly: true },
  { title: "Pedidos em Aberto", url: "/pedidos-aberto", icon: PackageOpen },
  { title: "Planejamento Gerencial", url: "/planejamento-gerencial", icon: ClipboardList, gestorOnly: true },
  { title: "Importações", url: "/importacoes", icon: Upload, gestorOnly: true },
  { title: "Integração IA", url: "/integracoes-ia", icon: Bot, gestorOnly: true },
  { title: "Planejamento IA", url: "/planejamento-ia", icon: Brain, gestorOnly: true },
  { title: "Alertas E-mails", url: "/alertas-email", icon: Mail, gestorOnly: true },


  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Shield, superOnly: true },
];

import React from "react";

const SidebarItemContent = ({ item, collapsed, badge }: { item: Item; collapsed: boolean; badge?: number }) => {
  const location = useLocation();
  const isActive = location.pathname === item.url || (item.url === "/" && location.pathname === "/");
  
  return (
    <>
      <div className={cn(
        "flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-300 relative",
        isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_20px_rgba(212,255,112,0.3)]" : "bg-white/5 text-sidebar-foreground group-hover/item:bg-white/10"
      )}>
        <item.icon 
          strokeWidth={isActive ? 2.5 : 2}
          className={cn(
            "h-5 w-5 shrink-0 transition-all duration-500",
            isActive ? "scale-110" : "opacity-80 group-hover/item:opacity-100 group-hover/item:scale-110"
          )} 
        />
        {collapsed && badge !== undefined && badge > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[8px] font-black flex items-center justify-center animate-bounce shadow-lg border border-white/20">
            {badge > 9 ? '9+' : badge}
          </div>
        )}
      </div>
      {!collapsed && (
        <span className={cn(
          "text-sm font-semibold tracking-wide transition-all duration-300",
          isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover/item:text-sidebar-foreground"
        )}>
          {item.title}
        </span>
      )}
      {isActive && !collapsed && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary shadow-[0_0_10px_rgba(212,255,112,0.8)]" />
      )}
      {!collapsed && badge !== undefined && badge > 0 && (
        <div className="ml-auto px-2 py-0.5 rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-black animate-pulse shadow-lg border border-white/20">
          {badge}
        </div>
      )}
    </>
  );
};

export const AppSidebar = React.memo(() => {
   const { state, isMobile, setOpenMobile } = useSidebar();
   const collapsed = state === "collapsed";
   const navigate = useNavigate();
   const { isGestor } = useRole();
   const { user } = useAuth();

   const { data: isSuper = false } = useQuery({
     queryKey: ["is-super", user?.id],
     queryFn: async () => {
       if (!user) return false;
       const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
       return (data ?? []).some((r: any) => r.role === "super_admin");
     },
     enabled: !!user,
     staleTime: Infinity,
   });

   const { data: pendingAlertsCount = 0 } = useQuery({
     queryKey: ["pending-alerts-count"],
     queryFn: async () => {
       const { count, error } = await supabase
         .from("ai_email_analyses")
         .select("*", { count: 'exact', head: true })
         .eq("status", "pending");
       
       if (error) return 0;
       return count || 0;
     },
     refetchInterval: 30000, // Sync every 30s
   });

   const filteredItems = useMemo(() => {
     return items.filter((i) => (!i.gestorOnly || isGestor) && (!i.superOnly || isSuper));
   }, [isGestor, isSuper]);

   const handleLogout = async () => {
     await supabase.auth.signOut();
     navigate("/auth");
   };

   return (
     <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent style={{ background: "var(--gradient-sidebar)" }} className="text-sidebar-foreground">
         <div className="flex items-center justify-between p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sidebar-primary flex items-center justify-center font-black shrink-0 shadow-[0_0_30px_rgba(212,255,112,0.2)] border-b-2 border-white/20 group-hover:rotate-3 transition-all duration-500">
              <span className="text-sidebar-primary-foreground text-lg tracking-tighter">AR</span>
            </div>
            {!collapsed && (
              <div className="overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="text-lg font-black tracking-tightest text-sidebar-foreground leading-none mb-1">Agro_RC</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary animate-pulse" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">CRM Intelligence</p>
                </div>
              </div>
            )}
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)} className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5 rounded-xl h-8 w-8">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
               {filteredItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                       className={({ isActive }) => cn(
                         "flex items-center gap-4 px-3 py-2.5 rounded-2xl transition-all duration-300 group/item relative overflow-hidden w-full h-auto", 
                         isActive 
                           ? "bg-white/5 border border-white/10" 
                           : "hover:bg-white/5 border border-transparent"
                       )}
                    >
                      <SidebarItemContent 
                        item={item} 
                        collapsed={collapsed} 
                        badge={item.url === "/alertas-email" ? pendingAlertsCount : undefined}
                      />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-6 space-y-3">
          {!collapsed && user?.email && (
             <div className="px-4 py-4 mb-4 rounded-3xl bg-white/[0.03] border border-white/[0.05] group transition-all hover:bg-white/[0.05]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30 mb-2">Workspace</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sidebar-primary/20 to-sidebar-primary/10 flex items-center justify-center border border-sidebar-primary/20">
                  <UserCircle className="h-4 w-4 text-sidebar-primary" />
                </div>
                <p className="text-xs font-bold text-sidebar-foreground/80 truncate leading-tight" title={user.email}>{user.email.split('@')[0]}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/60 hover:text-white hover:bg-rose-500/10 hover:border-rose-500/20 transition-all duration-300 group border border-transparent"
          >
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-rose-500/20 group-hover:text-rose-500 transition-colors">
              <LogOut className="h-4 w-4 shrink-0 transition-all group-hover:-translate-x-0.5" />
            </div>
            {!collapsed && <span>Sair do Sistema</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
   );
 });

 AppSidebar.displayName = "AppSidebar";