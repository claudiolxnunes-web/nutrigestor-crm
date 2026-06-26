import { useEffect, useState, useMemo } from "react";
import { useRole } from "@/hooks/useRole";
import { crmService } from "@/services/crmService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppLayout";
import { Seo } from "@/components/Seo";
import { PlanejamentoIA } from "@/components/crm/gerencial/PlanejamentoIA";
import { ShoppingBag, Users, AlertCircle, ArrowUpRight, TrendingUp, MapPin, Building2, ArrowRight, UserX, RefreshCw, Calendar, Check, Brain } from "lucide-react";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useOrg } from "@/hooks/useOrg";
import { fmtBRL, fmtPct } from "@/utils/crm/formatters";

type Visita = { data: string; cliente: string; cidade: string; rep: string };

const formatBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isGestor, gestorCode, loading: roleLoading } = useRole();
  const { orgId } = useOrg();
  const [refreshKey, setRefreshKey] = useState(0);



  useEffect(() => {
    if (!roleLoading && !isGestor && isGestor !== undefined) {
      navigate("/meu-painel", { replace: true });
    }
  }, [isGestor, roleLoading, navigate]);

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries();
      setRefreshKey((k) => k + 1);
    };
    const channel = new BroadcastChannel("importacoes_refresh");
    channel.onmessage = (event) => {
      if (event.data === "refresh") handler();
    };
    window.addEventListener("importacoes:refresh-all", handler);
    return () => {
      channel.close();
      window.removeEventListener("importacoes:refresh-all", handler);
    };
  }, [queryClient]);

  const { data: dashboardData, isLoading: dashboardLoading, refetch } = useQuery({
    queryKey: ["dashboard-data", orgId, gestorCode, refreshKey],
    queryFn: async () => {
      if (!orgId) return null;
      const hoje = new Date().toISOString().slice(0, 10);
      const hojeMenos90 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);

      let managedRcs: string[] = [];
      if (gestorCode) {
        const { data: reps } = await crmService.getRepresentantes(orgId, gestorCode);
        managedRcs = (reps ?? []).map(r => r.cod_rc).filter(Boolean);
      }

      const filterByRcs = (query: any, column = 'cod_rc') => {
        if (gestorCode) {
          if (managedRcs.length > 0) {
            return query.in(column, managedRcs);
          } else {
            return query.eq(column, '__FORCE_EMPTY__');
          }
        }
        return query;
      };

      const [r, c, p, plan, alertasPend, smartVenc, inativosCountRes, statsRpc] = await Promise.all([
        filterByRcs(supabase.from("representantes").select("id", { count: "exact", head: true }).eq("organizacao_id", orgId), 'cod_rc'),
        filterByRcs(supabase.from("clientes").select("id", { count: "exact", head: true }).eq("organizacao_id", orgId), 'cod_rc'),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("organizacao_id", orgId),
        filterByRcs(supabase.from("planejamento_semanal")
          .select("semana_inicio, dia_semana, cliente_nome, cidade, cod_rc")
          .eq("organizacao_id", orgId)
          .gte("semana_inicio", hoje)
          .eq("visitado", false)
          .order("semana_inicio", { ascending: true })
          .order("dia_semana", { ascending: true })
          .limit(5)),
        filterByRcs(supabase.from("alertas_rc")
          .select("id", { count: "exact", head: true })
          .eq("organizacao_id", orgId)
          .eq("status", "pendente")),
        filterByRcs(supabase.from("objetivos_smart")
          .select("id", { count: "exact", head: true })
          .eq("organizacao_id", orgId)
          .eq("status", "ativo")
          .lte("prazo", new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10))
          .gte("prazo", hoje)),
        filterByRcs(
          supabase.from("clientes")
            .select("id", { count: "exact", head: true })
            .eq("organizacao_id", orgId)
            .lt("ultima_compra", hojeMenos90),
          'cod_rc'
        ),
        supabase.rpc('get_dashboard_stats', { 
          _organizacao_id: orgId,
          _cod_rcs: managedRcs.length > 0 ? managedRcs : null,
          _cod_gestor: gestorCode ?? null
        })
      ]);

      const reps = await supabase.from("representantes").select("cod_rc, nome").eq("organizacao_id", orgId);
      const repMap = new Map<string, string>((reps.data ?? []).map((r) => [r.cod_rc ?? "", r.nome]));

      const visitas: Visita[] = (plan.data ?? []).map((v) => {
        const base = new Date(v.semana_inicio + "T00:00:00");
        base.setDate(base.getDate() + (v.dia_semana ?? 0));
        return {
          data: formatBR(base.toISOString().slice(0, 10)),
          cliente: v.cliente_nome,
          cidade: v.cidade ?? "—",
          rep: repMap.get(v.cod_rc ?? "") ?? "—",
        };
      });

      const alertas: string[] = [];
      if ((alertasPend.count ?? 0) > 0) alertas.push(`${alertasPend.count} alerta(s) de RC pendente(s) de resposta`);
      if ((smartVenc.count ?? 0) > 0) alertas.push(`${smartVenc.count} planejamento(s) SMART vencendo nos próximos 7 dias`);

      const rpcData: any = statsRpc.data ?? {};
      const orders = rpcData.orders || { valor: 0, volume: 0, qtd: 0, snapshot: null };
      const projected = rpcData.projected || { valor: 0, volume: 0 };
      const billing = rpcData.billing || { valor: 0, volume: 0, mb: 0, ml: 0, fat_base: 0 };

      return {
        counts: {
          representantes: r.count ?? 0,
          clientes: c.count ?? 0,
          produtos: p.count ?? 0,
          inativos: inativosCountRes.count ?? 0,
        },
        visitas,
        alertas,
        pedidosTotais: {
          valor: orders.valor,
          volume: orders.volume,
          qtd: orders.qtd,
          snapshot: orders.snapshot,
          projetadoValor: projected.valor,
          projetadoVolume: projected.volume,
          fatRealizado: billing.valor,
          volRealizado: billing.volume,
          mb: billing.mb,
          ml: billing.ml,
          fatBase: billing.fat_base,
        }
      };
    },
    enabled: !!orgId && !roleLoading,

  });

  const counts = dashboardData?.counts || { representantes: 0, clientes: 0, produtos: 0, inativos: 0 };
  const proximasVisitas = dashboardData?.visitas || [];
  const alertas = dashboardData?.alertas || [];
  const pedidosTotais = dashboardData?.pedidosTotais || { valor: 0, volume: 0, qtd: 0, snapshot: null, projetadoValor: 0, projetadoVolume: 0, fatRealizado: 0, volRealizado: 0, mb: 0, ml: 0, fatBase: 0 };


    const dynamicKpis = [
      { label: "Clientes", value: String(counts.clientes), icon: Building2, color: "text-blue-600", bg: "bg-blue-50", url: "/clientes" },
      { label: "Representantes", value: String(counts.representantes), icon: Users, color: "text-emerald-600", bg: "bg-emerald-50", url: "/representantes" },
      { label: "Inativos (90d+)", value: String(counts.inativos), icon: UserX, color: "text-orange-600", bg: "bg-orange-50", url: "/gerencial#clientes-inativos" },
      { label: "Alertas", value: String(alertas.length), icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50", url: "/gerencial" },
    ];

   return (
     <>
       <Seo title="Dashboard" description="Visão geral da operação comercial: pedidos em aberto, próximas visitas e alertas gerenciais do Agro_RC CRM." path="/" />
        <PageHeader 
          title="Olá, bem-vindo de volta!" 
          subtitle="Aqui está o que está acontecendo com sua operação comercial hoje." 
          actions={
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const channel = new BroadcastChannel("importacoes_refresh");
                channel.postMessage("refresh");
                window.dispatchEvent(new CustomEvent("importacoes:refresh-all"));
                queryClient.invalidateQueries();
                setRefreshKey(k => k + 1);
              }}

              className="h-9 gap-2 font-bold uppercase tracking-widest text-[10px]"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", dashboardLoading || roleLoading ? "animate-spin" : "")} />
              {dashboardLoading ? "Atualizando..." : "Atualizar Dados"}
            </Button>
          }
        />
       
       <div className="flex flex-col gap-8">
         <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white dark:bg-card p-4 rounded-[24px] border border-primary/20 shadow-sm flex items-center justify-between"
         >
           <div className="flex items-center gap-3">
             <div className="p-2.5 bg-primary/10 rounded-xl">
               <Brain className="h-5 w-5 text-primary" />
             </div>
             <div>
               <h4 className="text-sm font-bold leading-tight">Planejamento da Semana</h4>
               <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Inteligência Artificial</p>
             </div>
           </div>
           <Button 
             onClick={() => navigate("/planejamento-ia")}
             variant="default" 
             size="sm"
             className="h-9 px-5 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
           >
             Ver Insights <ArrowRight className="ml-2 h-3 w-3" />
           </Button>
         </motion.div>


         {/* Top Section: Overview Cards */}
         <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {dynamicKpis.map((k, i) => (
             <motion.div
               key={k.label}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
                className="group bg-white dark:bg-card rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 border border-white dark:border-white/5 shadow-sm transition-all hover:shadow-premium hover:-translate-y-1 relative overflow-hidden cursor-pointer"
                onClick={() => k.url && navigate(k.url)}
             >
              <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] transition-all group-hover:scale-150 group-hover:opacity-[0.06]", k.bg)} />
              <div className="flex items-center justify-between mb-6">
                <div className={cn("p-3 rounded-2xl shadow-sm group-hover:scale-110 transition-transform duration-500", k.bg)}>
                  <k.icon className={cn("h-6 w-6", k.color)} />
                </div>
                <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-tighter">
                  <ArrowUpRight className="h-3 w-3" />
                  Tendência
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{k.label}</h3>
               <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tightest leading-tight">{k.value}</div>
              </div>
            </motion.div>
          ))}
        </section>
 
        {/* Main Highlight: Pedidos em Aberto */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden bg-primary rounded-[32px] sm:rounded-[40px] p-6 sm:p-8 md:p-14 text-white shadow-premium"
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -mr-64 -mt-64 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-glow/20 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-12">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md shadow-xl border border-white/10">
                    <ShoppingBag className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-black text-2xl tracking-tight">Pedidos em Aberto</h3>
                </div>
                {pedidosTotais.snapshot && (
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/15 transition-colors rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10">
                    <Calendar className="h-3.5 w-3.5" />
                    Atualização: {formatBR(pedidosTotais.snapshot)}
                  </div>
                )}
              </div>
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/meu-painel#analise-carteira")}
                  className="bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-2xl px-6 h-12 font-black uppercase tracking-widest text-[10px] group/btn"
                >
                  <TrendingUp className="h-4 w-4 mr-2 transition-transform group-hover/btn:-translate-y-1" /> 
                  Analisar Performance
                  <ArrowRight className="h-3 w-3 ml-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
               </Button>
            </div>
            
            {(() => {
              const fatRealizado = pedidosTotais.fatRealizado || 0;
              const volRealizado = pedidosTotais.volRealizado || 0;
              const fatBase = pedidosTotais.fatBase || 0;
              const mbPct = fatBase > 0 ? (pedidosTotais.mb || 0) / fatBase : 0;
              const mlPct = fatBase > 0 ? (pedidosTotais.ml || 0) / fatBase : 0;
              return (
                <div className="space-y-8 md:space-y-10">
                  {/* Linha 1: Faturamento (R$) */}
                  <div className="grid gap-6 md:gap-10 grid-cols-1 md:grid-cols-3">
                    <div className="space-y-1 sm:space-y-2 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Faturamento</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {fmtBRL(fatRealizado)}
                      </p>
                    </div>
                    <div className="space-y-1 sm:space-y-2 border-white/10 md:border-l md:pl-10 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Pedidos em Aberto</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {fmtBRL(pedidosTotais.valor)}
                      </p>
                    </div>
                    <div className="space-y-1 sm:space-y-2 border-white/10 md:border-l md:pl-10 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Provável Faturamento do Mês</p>
                      <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {fmtBRL(pedidosTotais.projetadoValor)}
                      </p>
                    </div>
                  </div>

                  {/* Linha 2: Volume (kg) */}
                  <div className="grid gap-6 md:gap-10 grid-cols-1 md:grid-cols-3 pt-6 md:pt-8 border-t border-white/10">
                    <div className="space-y-1 sm:space-y-2 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Volume Faturado</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {volRealizado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-base sm:text-lg font-medium opacity-40 group-hover:opacity-60">kg</span>
                      </p>
                    </div>
                    <div className="space-y-1 sm:space-y-2 border-white/10 md:border-l md:pl-10 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Volume em Aberto</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {(pedidosTotais.volume || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-base sm:text-lg font-medium opacity-40 group-hover:opacity-60">kg</span>
                      </p>
                    </div>
                    <div className="space-y-1 sm:space-y-2 border-white/10 md:border-l md:pl-10 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Volume Provável do Mês</p>
                      <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {(pedidosTotais.projetadoVolume || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-lg sm:text-xl font-medium opacity-40 group-hover:opacity-60">kg</span>
                      </p>
                    </div>
                  </div>

                  {/* Rodapé: Quantidade de pedidos */}
                  <div className="pt-4 flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                    <span>Volume de Carteira:</span>
                    <span className="text-white/80">{pedidosTotais.qtd.toLocaleString("pt-BR")} pedidos</span>
                  </div>

                  {/* Margens */}
                  <div className="grid gap-6 md:gap-10 grid-cols-1 md:grid-cols-2 pt-6 md:pt-8 border-t border-white/10">
                    <div className="space-y-1 sm:space-y-2 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Margem Bruta</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {fmtBRL(pedidosTotais.mb)} <span className="text-base sm:text-lg font-medium opacity-50">({fmtPct(mbPct)})</span>
                      </p>
                    </div>
                    <div className="space-y-1 sm:space-y-2 border-white/10 md:border-l md:pl-10 group cursor-default">
                      <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] group-hover:text-white/60 transition-colors">Margem Líquida</p>
                      <p className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tightest group-hover:scale-105 transition-transform origin-left duration-500">
                        {fmtBRL(pedidosTotais.ml)} <span className="text-base sm:text-lg font-medium opacity-50">({fmtPct(mlPct)})</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </motion.section>
 
         {/* Bottom Grid: Visitas and Alertas */}
        <section className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-2">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="premium-card p-5 sm:p-8 md:p-10"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/5 rounded-2xl shadow-inner-soft">
                  <MapPin className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 dark:text-white leading-tight">Próximas Visitas</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Roteiro da Equipe</p>
                </div>
              </div>
              <Button variant="ghost" className="text-primary font-black uppercase tracking-widest text-[10px] h-10 px-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-all">Ver Completo</Button>
            </div>
            
            <div className="overflow-hidden">
              {proximasVisitas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-20 w-20 bg-slate-50 dark:bg-white/5 rounded-[24px] flex items-center justify-center mb-6 shadow-inner-soft">
                    <Calendar className="h-10 w-10 text-slate-200 dark:text-slate-700" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Agenda Vazia
                  </p>
                </div>
              ) : (
              <div className="space-y-4">
                {proximasVisitas.map((v, i) => (
                  <motion.div 
                    key={`${v.cliente}-${i}`}
                    whileHover={{ scale: 1.01, x: 4 }}
                    className="group flex items-center justify-between p-5 rounded-[22px] bg-slate-50/50 dark:bg-white/5 border border-transparent hover:border-slate-100 dark:hover:border-white/10 hover:bg-white dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 shadow-soft border border-slate-100 dark:border-white/5">
                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{v.data.split('/')[1]}</span>
                        <span className="text-lg font-black text-primary leading-none">{v.data.split('/')[0]}</span>
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white text-base leading-tight mb-1 group-hover:text-primary transition-colors">{v.cliente}</p>
                        <div className="flex items-center gap-2 text-slate-500">
                          <MapPin className="h-3 w-3" />
                          <span className="text-xs font-bold">{v.cidade}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm group-hover:border-primary/20 transition-all">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-black text-primary">
                          {v.rep.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tighter">{v.rep.split(' ')[0]}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="premium-card p-8 md:p-10"
          >
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl shadow-inner-soft">
                <AlertCircle className="h-7 w-7 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-xl text-slate-900 dark:text-white leading-tight">Alertas Gerenciais</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ações Necessárias</p>
              </div>
            </div>
            
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-[24px] flex items-center justify-center mb-6 shadow-inner-soft">
                  <Check className="h-10 w-10 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                  Operação Limpa
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertas.map((a, i) => (
                  <motion.div 
                    key={a} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + (i * 0.1) }}
                    whileHover={{ x: 6 }}
                    className="flex items-start gap-5 p-6 rounded-[24px] bg-slate-50/50 dark:bg-white/5 border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20 hover:bg-white dark:hover:bg-white/[0.08] transition-all cursor-pointer shadow-sm"
                  >
                    <div className="mt-1 h-3 w-3 rounded-full bg-rose-500 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed">
                        {a}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded uppercase tracking-widest">Prioridade Crítica</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">&bull; pendente há 2h</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </section>
       </div>
     </>
   );
};

export default Index;
