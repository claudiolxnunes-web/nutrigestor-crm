import { useEffect, useMemo, useState, useCallback } from "react";
import { format, startOfWeek, endOfMonth, differenceInBusinessDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, Users, Target, RefreshCw, Package, ShoppingBag, Info, Lightbulb, UserX, ArrowRight, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
 import { supabase } from "@/integrations/supabase/client";
 import { useRole } from "@/hooks/useRole";
 import { useOrg } from "@/hooks/useOrg";
 import { crmService } from "@/services/crmService";
 import { Seo } from "@/components/Seo";
  import { useCrmKpis } from "@/hooks/crm/useCrmKpis";
  import { useQueryClient } from "@tanstack/react-query";

 import { fmtBRL, fmtPct, fmtNum } from "@/utils/crm/formatters";
 import { Venda, Meta, Rep, PedidoAberto } from "@/types/crm";
import { RcDrilldownDialog } from "@/components/crm/gerencial/RcDrilldownDialog";
import { AlertasGestor } from "@/components/crm/alertas/AlertasGestor";
import { InsightResumo } from "@/components/crm/gerencial/InsightResumo";
import { InsightsCompletos } from "@/components/crm/gerencial/InsightsCompletos";
import { AIProviderStatus } from "@/components/crm/gerencial/AIProviderStatus";
import { HistoricoProdutosDialog } from "@/components/crm/HistoricoProdutosDialog";
import { ScoreAnaliseDialog, type ScoreAnaliseData } from "@/components/crm/gerencial/ScoreAnaliseDialog";
import { ClientesInativosCard } from "@/components/crm/gerencial/ClientesInativosCard";
import { ChurnMonitor } from "@/components/crm/gerencial/ChurnMonitor";
import { PositivacaoManager } from "@/components/crm/gerencial/PositivacaoManager";
import { MesMultiSelect } from "@/components/crm/MesMultiSelect";
import { Card } from "@/components/ui/card";

 type PlanItem = { user_id: string; semana_inicio: string; dia_semana: number; visitado: boolean };
 type Interacao = { user_id: string; data: string; tipo: string; status_pedido: string | null };
 
 const DashboardCard = ({ label, value, hint, icon: Icon, color, bg }: { label: string; value: string; hint?: string; icon: any; color: string; bg: string }) => (
   <div className="bg-white dark:bg-card rounded-[22px] p-6 border border-white dark:border-white/5 shadow-sm transition-all hover:shadow-lg" style={{ boxShadow: "var(--shadow-card)" }}>
     <div className="flex items-center justify-between mb-4">
       <div className={cn("p-2.5 rounded-xl", bg)}>
         <Icon className={cn("h-5 w-5", color)} />
       </div>
       {hint && <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{hint}</div>}
     </div>
     <div className="space-y-1">
       <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</h3>
       <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
     </div>
   </div>
 );

const sum = (arr: any[], k: string) => arr.reduce((a, x) => a + (Number(x[k]) || 0), 0);

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

  const Gerencial = () => {
    const { isGestor, gestorCode, loading: roleLoading } = useRole();
    const queryClient = useQueryClient();

    const { orgId } = useOrg();
    const [vendas, setVendas] = useState<Venda[]>([]);
    const [allMeses, setAllMeses] = useState<string[]>([]);
    const [metas, setMetas] = useState<Meta[]>([]);
    const [reps, setReps] = useState<Rep[]>([]);
    const [planos, setPlanos] = useState<PlanItem[]>([]);
    const [interacoes, setInteracoes] = useState<Interacao[]>([]);
    const [acoesAbertas, setAcoesAbertas] = useState<{ rc_user_id: string }[]>([]);
    const [pedidosAberto, setPedidosAberto] = useState<PedidoAberto[]>([]);
    const [loading, setLoading] = useState(true);
    const [mes, setMes] = useState(currentMonth());
    const [mesesSel, setMesesSel] = useState<string[]>([currentMonth()]);
    const [periodo, setPeriodo] = useState<"semana" | "mes">("mes");
    const [drilldown, setDrilldown] = useState<{ rcUserId: string | null; nome: string; cod_rc: string | null } | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [openProdutos, setOpenProdutos] = useState(false);
    const [scoreAnalise, setScoreAnalise] = useState<ScoreAnaliseData | null>(null);
    const [consistencyError, setConsistencyError] = useState<{ type: "vendas" | "pedidos"; ui: number; db: number } | null>(null);

    const load = useCallback(async () => {
      if (!isGestor || !orgId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const semanaIni = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
        const inicioMes = `${mes}-01`;
        const fimMes = format(endOfMonth(new Date(`${mes}-01T00:00:00`)), "yyyy-MM-dd");

        // Calculate mesAnterior for comparison
        const [y, m] = mes.split("-").map(Number);
        const dAnterior = new Date(y, m - 2, 1);
        const mesAnt = `${dAnterior.getFullYear()}-${String(dAnterior.getMonth() + 1).padStart(2, "0")}`;

        // Fetch only needed months for performance
        const monthsToFetch = Array.from(new Set([...mesesSel, mes, mesAnt]));

        const [vendasRes, metasAll, pedidosAll, repsRes, planosRes, interRes, acoesRes, monthsRes] = await Promise.all([
          crmService.getVendas(orgId, monthsToFetch, null, gestorCode),
          crmService.getMetas(orgId, null, gestorCode),
          crmService.getPedidosAberto(orgId, null, gestorCode),
          crmService.getRepresentantes(orgId, gestorCode),
          (() => {
            let q = supabase.from("planejamento_semanal").select("user_id, semana_inicio, dia_semana, visitado")
              .eq("semana_inicio", semanaIni);
            if (gestorCode) q = q.eq("cod_gestor", gestorCode);
            return q;
          })(),
          (() => {
            let q = supabase.from("interacoes").select("user_id, data, tipo, status_pedido")
              .gte("data", inicioMes).lte("data", `${fimMes}T23:59:59`);
            if (gestorCode) q = q.eq("cod_gestor", gestorCode);
            return q;
          })(),
          (() => {
            let q = (supabase.from("acoes_gestor") as any).select("rc_user_id").eq("status", "aberta").eq("organizacao_id", orgId);
            // Note: acoes_gestor might not have cod_gestor yet, using gestor_id if possible
            return q;
          })(),
          crmService.getMesesDisponiveis(orgId),
        ]);

        setVendas(vendasRes as Venda[]);
        setMetas(metasAll as Meta[]);
        setPedidosAberto(pedidosAll as PedidoAberto[]);
        setReps((repsRes.data ?? []) as Rep[]);
        setPlanos((planosRes.data ?? []) as PlanItem[]);
        setInteracoes((interRes.data ?? []) as Interacao[]);
        setAcoesAbertas((acoesRes.data ?? []));
        setAllMeses(monthsRes);
      } catch (err: any) {
        console.error("Erro ao carregar dados gerenciais:", err);
      } finally {
        setLoading(false);
      }
    }, [isGestor, orgId, mes, mesesSel]);

     useEffect(() => {
       load();
     }, [load, refreshKey]);
 
     useEffect(() => {
       const handler = () => {
         console.log("Detectada nova importação, recarregando dados gerenciais...");
         setRefreshKey(prev => prev + 1);
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
     }, []);

  // Se o mês corrente não tiver dados (vendas/metas), salta automaticamente
  // para o mês mais recente disponível para que os cards exibam números reais.
  useEffect(() => {
    if (allMeses.length === 0) return;
    if (allMeses.includes(mes)) return;
    const maisRecente = allMeses[0];
    setMes(maisRecente);
    setMesesSel([maisRecente]);
  }, [allMeses, mes]);

   const mesesDisponiveis = useMemo(() => {
     if (allMeses.length > 0) return allMeses;
     const set = new Set<string>();
     vendas.forEach((v) => v.mes_ano && set.add(v.mes_ano));
     metas.forEach((m) => m.mes_ano && set.add(m.mes_ano));
     return Array.from(set).sort().reverse();
   }, [vendas, metas, allMeses]);

  const mesesSelSet = useMemo(() => new Set(mesesSel), [mesesSel]);
  const vendasMes = useMemo(
    () => vendas.filter((v) => v.mes_ano && mesesSelSet.has(v.mes_ano)),
    [vendas, mesesSelSet]
  );
  const metasMes = useMemo(
    () => metas.filter((m) => mesesSelSet.has(m.mes_ano)),
    [metas, mesesSelSet]
  );
  const isPeriodoUnico = mesesSel.length === 1;
  const labelPeriodo = useMemo(() => {
    if (mesesSel.length === 0) return mes;
    if (mesesSel.length === 1) return mesesSel[0];
    const sorted = [...mesesSel].sort();
    return `${sorted[0]} → ${sorted[sorted.length - 1]} (${mesesSel.length} meses)`;
  }, [mesesSel, mes]);

  // Mantém o "mes" sincronizado com o maior mês da seleção (usado por regras temporais
  // como dias úteis restantes, mês anterior comparativo, snapshot de pedidos etc.)
  useEffect(() => {
    if (mesesSel.length === 0) return;
    const principal = [...mesesSel].sort().reverse()[0];
    if (principal !== mes) setMes(principal);
  }, [mesesSel, mes]);

  // Faturamento do mês anterior (para comparativo do card destaque)
  const mesAnterior = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [mes]);
  const fatMesAnterior = useMemo(
    () => sum(vendas.filter((v) => v.mes_ano === mesAnterior), "faturamento_realizado"),
    [vendas, mesAnterior]
  );

  // Pedidos em aberto: snapshot mais recente.
  // Separa entre "do mês selecionado" (prev_faturamento dentro do mês OU sem previsão)
  // e "próximos meses" (prev_faturamento em mês posterior ao selecionado).
  const isMesCorrente = mes === currentMonth();
  const pedidosVigentes = useMemo(() => {
    if (pedidosAberto.length === 0) return [] as PedidoAberto[];
    const ultimo = pedidosAberto.reduce((max, p) => (p.data_snapshot && p.data_snapshot > max ? p.data_snapshot : max), "");
    return ultimo ? pedidosAberto.filter((p) => p.data_snapshot === ultimo) : pedidosAberto;
  }, [pedidosAberto]);

  const prevMes = (p: PedidoAberto) => (p.prev_faturamento ? p.prev_faturamento.slice(0, 7) : "");

  const abertoTotais = useMemo(() => {
    const porRC = new Map<string, { valor: number; volume: number; futuro: number; volumeFuturo: number }>();
    const porLinhaMap = new Map<string, { valor: number; volume: number; futuro: number; volumeFuturo: number }>();
    let valor = 0, volume = 0, futuro = 0, volumeFuturo = 0;
    if (!isMesCorrente) {
      return { valor, volume, futuro, volumeFuturo, porRC, porLinha: porLinhaMap };
    }
    pedidosVigentes.forEach((p) => {
      const v = Number(p.valor) || 0;
      const k = Number(p.volume) || 0;
      const pm = prevMes(p);
      const isFuturo = pm && pm > mes;
      // Pedidos com previsão em mês anterior ao selecionado são ignorados (atrasados/faturados após snapshot).
      const isAnterior = pm && pm < mes;
      if (isAnterior) return;

      const rc = p.cod_rc || "—";
      const ln = p.linha || "—";
      const curRC = porRC.get(rc) ?? { valor: 0, volume: 0, futuro: 0, volumeFuturo: 0 };
      const curLn = porLinhaMap.get(ln) ?? { valor: 0, volume: 0, futuro: 0, volumeFuturo: 0 };

      if (isFuturo) {
        futuro += v; volumeFuturo += k;
        curRC.futuro += v; curRC.volumeFuturo += k;
        curLn.futuro += v; curLn.volumeFuturo += k;
      } else {
        valor += v; volume += k;
        curRC.valor += v; curRC.volume += k;
        curLn.valor += v; curLn.volume += k;
      }
      porRC.set(rc, curRC);
      porLinhaMap.set(ln, curLn);
    });
    return { valor, volume, futuro, volumeFuturo, porRC, porLinha: porLinhaMap };
  }, [pedidosVigentes, isMesCorrente, mes]);

   const kpis = useCrmKpis({
     vendas: vendasMes,
     metas: metasMes,
     pedidosAberto: pedidosVigentes,
     mesCorrente: mes
   });

   // Validação de consistência entre UI e Server
   useEffect(() => {
     if (loading || !orgId || (vendasMes.length === 0 && pedidosVigentes.length === 0)) return;

     const validate = async () => {
       try {
         const { data, error } = await supabase.rpc('check_data_consistency', {
           _organizacao_id: orgId,
           _meses: mesesSel,
           _cod_rcs: gestorCode ? (reps.map(r => r.cod_rc).filter(Boolean) as string[]) : null
         });

         if (error) throw error;
         if (!data) return;

         const server = data as any;
         
         // Verifica Vendas
         const uiFat = kpis.fat;
         const dbFat = Number(server.vendas.faturamento) || 0;
         if (Math.abs(uiFat - dbFat) > 0.01) {
           console.error("Divergência detectada no Faturamento:", { ui: uiFat, db: dbFat });
           setConsistencyError({ type: "vendas", ui: uiFat, db: dbFat });
           return;
         }

         // Verifica Pedidos (apenas se for o mês corrente e tivermos dados)
         if (isMesCorrente && pedidosVigentes.length > 0) {
           const uiAberto = abertoTotais.valor;
           const dbAberto = Number(server.pedidos.valor) || 0;
           if (Math.abs(uiAberto - dbAberto) > 0.01) {
             console.error("Divergência detectada nos Pedidos em Aberto:", { ui: uiAberto, db: dbAberto });
             setConsistencyError({ type: "pedidos", ui: uiAberto, db: dbAberto });
             return;
           }
         }

         setConsistencyError(null);
       } catch (err) {
         console.error("Erro na validação de consistência:", err);
       }
     };

     validate();
   }, [loading, orgId, mesesSel, gestorCode, reps, kpis.fat, abertoTotais.valor, isMesCorrente, pedidosVigentes.length]);

  const rankingRC = useMemo(() => {
    const map = new Map<string, { cod_rc: string; nome: string; fat: number; vol: number; mb: number; ml: number; comissao: number; meta: number; aberto: number }>();
    vendasMes.forEach((v) => {
      const key = v.cod_rc || "—";
      const cur = map.get(key) ?? { cod_rc: key, nome: v.representante ?? "—", fat: 0, vol: 0, mb: 0, ml: 0, comissao: 0, meta: 0, aberto: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      cur.mb += Number(v.mb_cb_total) || 0;
      cur.ml += Number(v.ml_cb_total) || 0;
      cur.comissao += Number(v.comissao_realizada) || 0;
      if (v.representante) cur.nome = v.representante;
      map.set(key, cur);
    });
    metasMes.forEach((m) => {
      const cur = map.get(m.cod_rc) ?? { cod_rc: m.cod_rc, nome: "—", fat: 0, vol: 0, mb: 0, ml: 0, comissao: 0, meta: 0, aberto: 0 };
      cur.meta += Number(m.meta_faturamento) || 0;
      map.set(m.cod_rc, cur);
    });
    abertoTotais.porRC.forEach((v, key) => {
      const cur = map.get(key) ?? { cod_rc: key, nome: "—", fat: 0, vol: 0, mb: 0, ml: 0, comissao: 0, meta: 0, aberto: 0 };
      cur.aberto += v.valor;
      map.set(key, cur);
    });
    const arr = Array.from(map.values());
    arr.forEach((r) => {
      if (!r.nome || r.nome === "—") {
        const rep = reps.find((x) => x.cod_rc === r.cod_rc);
        if (rep?.nome) r.nome = rep.nome;
      }
    });
    return arr.sort((a, b) => b.fat - a.fat);
  }, [vendasMes, metasMes, abertoTotais, reps]);

  const porLinha = useMemo(() => {
    const map = new Map<string, { linha: string; fat: number; mb: number; ml: number; meta: number; vol: number; aberto: number }>();
    vendasMes.forEach((v) => {
      const key = v.linha || "—";
      const cur = map.get(key) ?? { linha: key, fat: 0, mb: 0, ml: 0, meta: 0, vol: 0, aberto: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.mb += Number(v.mb_cb_total) || 0;
      cur.ml += Number(v.ml_cb_total) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      map.set(key, cur);
    });
    metasMes.forEach((m) => {
      const cur = map.get(m.linha) ?? { linha: m.linha, fat: 0, mb: 0, ml: 0, meta: 0, vol: 0, aberto: 0 };
      cur.meta += Number(m.meta_faturamento) || 0;
      map.set(m.linha, cur);
    });
    abertoTotais.porLinha.forEach((v, key) => {
      const cur = map.get(key) ?? { linha: key, fat: 0, mb: 0, ml: 0, meta: 0, vol: 0, aberto: 0 };
      cur.aberto += v.valor;
      map.set(key, cur);
    });

    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const hierarquia = {
      "NUTRICAO RUMINANTES": new Set([
        "PREMIX E OUTROS", 
        "GORDURAS PROPRIAS", 
        "SAL MINERAL", 
        "LACTEOS", 
        "GRAO INTEIRO",
        "BOVINOS DE CORTE",
        "BOVINOS DE LEITE",
        "LEITE",
        "CORTE",
        "OUTROS RUMINANTES",
        "OVINOS",
        "CAPRINOS",
        "BUBALINOS"
      ]),
    };

    map.forEach((cur, key) => {
      const k = norm(key);
      Object.entries(hierarquia).forEach(([paiNome, filhos]) => {
        if (filhos.has(k)) {
          const pai = map.get(paiNome) ?? { linha: paiNome, fat: 0, vol: 0, meta: 0, aberto: 0, mb: 0, ml: 0 };
          pai.fat += cur.fat;
          pai.vol += cur.vol;
          pai.meta += cur.meta;
          pai.aberto += cur.aberto;
          pai.mb += cur.mb;
          pai.ml += cur.ml;
          map.set(paiNome, pai);
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.fat - a.fat);
  }, [vendasMes, metasMes, abertoTotais]);

  const topClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; fat: number; mb: number; ml: number }>();
    vendasMes.forEach((v) => {
      const key = v.cod_cliente || v.nome_cliente || "—";
      const cur = map.get(key) ?? { cliente: v.nome_cliente ?? key, fat: 0, mb: 0, ml: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.mb += Number(v.mb_cb_total) || 0;
      cur.ml += Number(v.ml_cb_total) || 0;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.mb - a.mb).slice(0, 10);
  }, [vendasMes]);

  // ====== ACOMPANHAMENTO DA EQUIPE (Score composto + risco) ======
  const equipe = useMemo(() => {
    const hoje = new Date();
    const fimMes = endOfMonth(new Date(`${mes}-01T00:00:00`));
    const diasUteisRest = Math.max(0, differenceInBusinessDays(fimMes, hoje));
    const diaDoMes = hoje.getDate();
    const totalDiasMes = fimMes.getDate();
    const expectedPct = Math.min(1, diaDoMes / totalDiasMes);

    // Base: representantes ativos cadastrados.
    const repsBase: Rep[] = reps.filter(r => r.status !== "inativo");
    const codsConhecidos = new Set(repsBase.map(r => r.cod_rc).filter(Boolean) as string[]);

    // RCs "fantasmas": aparecem em vendas / metas / pedidos em aberto do mês selecionado
    // mas não estão cadastrados em representantes (ou estão como inativo).
    // Sem eles, o Acompanhamento fica divergente do Ranking — o gestor precisa enxergar
    // todos que estão produzindo, mesmo sem cadastro formal.
    const fantasmas = new Map<string, Rep>();
    const addFantasma = (cod: string | null | undefined, nome: string | null | undefined) => {
      if (!cod || codsConhecidos.has(cod) || fantasmas.has(cod)) return;
      fantasmas.set(cod, {
        id: `ghost-${cod}`,
        cod_rc: cod,
        nome: nome?.trim() || `RC ${cod}`,
        auth_user_id: null,
        status: "sem_cadastro",
      });
    };
    vendasMes.forEach(v => addFantasma(v.cod_rc, v.representante));
    metasMes.forEach(m => addFantasma(m.cod_rc, null));
    abertoTotais.porRC.forEach((_v, cod) => addFantasma(cod, null));

    return [...repsBase, ...fantasmas.values()].map((rep) => {
      const vendasRC = vendasMes.filter(v => v.cod_rc === rep.cod_rc);
      const fatRC = vendasRC.reduce((s, v) => s + (Number(v.faturamento_realizado) || 0), 0);
      const fatBaseRC = vendasRC.reduce((s, v) => s + (Number(v.faturamento_sem_encargos) || 0), 0);
      const mbRC = vendasRC.reduce((s, v) => s + (Number(v.mb_cb_total) || 0), 0);
      const mlRC = vendasRC.reduce((s, v) => s + (Number(v.ml_cb_total) || 0), 0);
      const comissaoRC = vendasRC.reduce((s, v) => s + (Number(v.comissao_realizada) || 0), 0);
      // Margem em % é ponderada pelo faturamento sem encargos (base de cálculo da margem).
      const mbPctRC = fatBaseRC > 0 ? mbRC / fatBaseRC : 0;
      const mlPctRC = fatBaseRC > 0 ? mlRC / fatBaseRC : 0;
      const metaRC = metasMes.filter(m => m.cod_rc === rep.cod_rc)
        .reduce((s, m) => s + (Number(m.meta_faturamento) || 0), 0);
      const atingPct = metaRC > 0 ? fatRC / metaRC : 0;

      const planosRC = rep.auth_user_id ? planos.filter(p => p.user_id === rep.auth_user_id) : [];
       const planSemana = planosRC; // conjunto da semana corrente
      const planTotal = planSemana.length;
      const planFeitos = planSemana.filter(p => p.visitado).length;
      const cumprimentoPct = planTotal > 0 ? planFeitos / planTotal : 0;

      const interRC = rep.auth_user_id ? interacoes.filter(i => i.user_id === rep.auth_user_id) : [];
      const totalInter = interRC.length;
      // referência: 30 interações/mês = 100%
      const atividadePct = Math.min(1, totalInter / 30);

      const orcamentos = interRC.filter(i => i.status_pedido === "orcamento" || i.status_pedido === "vendido" || i.status_pedido === "perdido").length;
      const vendidos = interRC.filter(i => i.status_pedido === "vendido").length;
      const conversaoPct = orcamentos > 0 ? vendidos / orcamentos : (totalInter > 0 ? 0.5 : 0);

      const abertoRC = rep.cod_rc ? (abertoTotais.porRC.get(rep.cod_rc)?.valor ?? 0) : 0;

      // Saúde da Carteira: % de clientes distintos comprando que foram visitados
      const clientesAtivos = new Set(vendasRC.map(v => v.cod_cliente).filter(Boolean));
      const saudeCarteiraPct = clientesAtivos.size > 0 ? (interRC.filter(i => i.tipo === 'visita').length / clientesAtivos.size) : 0;

      // Score 0-100: 40% meta, 25% plano, 20% atividade, 15% conversão.
      const projAting = metaRC > 0 ? (fatRC + abertoRC) / metaRC : atingPct;
      const metaScore = metaRC > 0 ? Math.min(1.5, projAting) : 0.5;
      const score = Math.round((metaScore * 40) + (cumprimentoPct * 25) + (atividadePct * 20) + (conversaoPct * 15));

      let nivel: "ok" | "atencao" | "risco" = "ok";
      // Se já bateu a meta (real ou projeção), nunca classifica como risco.
      if (metaRC > 0 && projAting >= 1) {
        nivel = score < 60 ? "atencao" : "ok";
      } else if (score < 50) {
        nivel = "risco";
      } else if (score < 70) {
        nivel = "atencao";
      }

      const acoesRC = rep.auth_user_id ? acoesAbertas.filter(a => a.rc_user_id === rep.auth_user_id).length : 0;

      return {
        rep, fatRC, fatBaseRC, mbRC, mlRC, comissaoRC, mbPctRC, mlPctRC,
        abertoRC, metaRC, atingPct, planTotal, planFeitos, cumprimentoPct,
        totalInter, atividadePct, conversaoPct, score, nivel, acoesRC, diasUteisRest,
        saudeCarteiraPct
      };
    }).sort((a, b) => a.score - b.score);
  }, [reps, vendasMes, metasMes, planos, interacoes, acoesAbertas, abertoTotais, mes, periodo]);

  const equipeKpis = useMemo(() => {
    const total = equipe.length;
    const emRisco = equipe.filter(e => e.nivel === "risco").length;
    const atencao = equipe.filter(e => e.nivel === "atencao").length;
    const totalPlan = equipe.reduce((s, e) => s + e.planTotal, 0);
    const totalFeitos = equipe.reduce((s, e) => s + e.planFeitos, 0);
    return { total, emRisco, atencao, totalPlan, totalFeitos };
  }, [equipe]);

  const analiseInativos = useMemo(() => {
    const hoje = new Date();
    const ativosIds = new Set(vendasMes.map(v => v.cod_cliente).filter(Boolean));
    const ativosCount = ativosIds.size;
    const historicoClientes = new Map<string, { nome: string; cidade: string; ultima: string }>();
    
    vendas.forEach(v => {
      const id = v.cod_cliente;
      if (!id) return;
      const cidade = v.municipio || "Outros";
      const data = v.data_nf || "";
      const ex = historicoClientes.get(id);
      if (!ex || data > ex.ultima) {
        historicoClientes.set(id, { nome: v.nome_cliente || "", cidade, ultima: data });
      }
    });

    const inativosPorCidade = new Map<string, number>();
    let totalInativos = 0;

    historicoClientes.forEach((c, id) => {
      if (ativosIds.has(id)) return;
      const diff = Math.floor((hoje.getTime() - new Date(c.ultima).getTime()) / 86400000);
      if (diff >= 90) { 
        totalInativos++;
        inativosPorCidade.set(c.cidade, (inativosPorCidade.get(c.cidade) || 0) + 1);
      }
    });

    const topCidades = Array.from(inativosPorCidade.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { total: totalInativos, topCidades, ativosCount };
  }, [vendas, vendasMes]);

   if (roleLoading) {
     return (
       <div className="flex h-[50vh] items-center justify-center">
         <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
       </div>
     );
   }
   
   if (!isGestor) {
    return (
      <>
        <PageHeader title="Planejamento Gerencial" subtitle="Acesso restrito" />
        <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-muted-foreground">Esta área é restrita ao perfil gestor. Solicite acesso ao administrador.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Gestão Gerencial" description="KPIs, ranking de representantes, comparativo realizado vs meta e insights de IA para tomada de decisão." path="/gerencial" />
      <PageHeader 
        title="Gestão Gerencial" 
        subtitle="KPIs, ranking e comparativo Realizado vs Meta" 
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
            <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
            Atualizar Dados
          </Button>
        }
      />
      
      {/* Painel de Orientação Estratégica para o Gestor */}
      <Card className="mb-5 border-primary/20 bg-primary/5 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Lightbulb className="h-16 w-16" />
        </div>
        <div className="p-5 flex gap-4 items-start relative z-10">
          <div className="hidden sm:flex h-10 w-10 rounded-full bg-primary/10 items-center justify-center shrink-0">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
              Diretriz Gerencial: Gestão em Tempo Real
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              A gestão de alta performance exige acompanhamento diário. Utilize este painel para identificar desvios entre o faturamento realizado e o <strong>Acompanhamento da Equipe</strong> (MB% e ML%). 
              Busque correlações entre a <strong>Atividade dos RCs</strong> (visitas e interações) e a <strong>Conversão de Pedidos</strong>. O foco deve ser na qualidade da margem e no preenchimento do funil de oportunidades.
            </p>
             <div className="flex flex-col sm:flex-row flex-wrap gap-x-4 gap-y-3 justify-between items-start sm:items-center pt-1">
               <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                 <span className="flex items-center gap-1">● MB% Ideal: &gt; 25%</span>
                 <span className="flex items-center gap-1">● Atividade: &gt; 30 interações/mês</span>
                 <span className="flex items-center gap-1">● Execução: &gt; 80% do plano</span>
               </div>
               <Button 
                 variant="link" 
                 size="sm" 
                 className="h-auto p-0 text-[10px] font-bold uppercase tracking-wider text-primary hover:no-underline group"
                 onClick={() => document.getElementById('clientes-inativos')?.scrollIntoView({ behavior: 'smooth' })}
               >
                 Ir para Clientes Inativos <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-1" />
               </Button>
             </div>
          </div>
        </div>
      </Card>

      {consistencyError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold uppercase tracking-tight text-xs">Aviso de Consistência de Dados</AlertTitle>
            <AlertDescription className="text-xs">
              Detectamos uma divergência entre a soma local e o total do banco de dados nos 
              <strong> {consistencyError.type === "vendas" ? "Faturamentos" : "Pedidos em Aberto"}</strong>.
              <br />
              Local: {fmtBRL(consistencyError.ui)} | Banco: {fmtBRL(consistencyError.db)}
              <br />
              Isso pode ocorrer devido a filtros de segurança (RLS) ou limites de linhas. Tente recarregar os dados.
            </AlertDescription>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 h-7 text-[10px] font-bold uppercase tracking-widest border-destructive/20 hover:bg-destructive/10 text-destructive"
              onClick={() => setRefreshKey(k => k + 1)}
            >
              Recarregar agora
            </Button>
          </Alert>
        </motion.div>
      )}

      <div className="space-y-5">
         <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 justify-between">
           <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <MesMultiSelect available={mesesDisponiveis} value={mesesSel} onChange={setMesesSel} />
          {loading && <Badge variant="secondary">Carregando…</Badge>}
          {!loading && vendasMes.length === 0 && (
            <Badge variant="secondary">Sem vendas em {labelPeriodo}. Importe a base na tela Importações.</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar dados
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpenProdutos(true)}
          >
            <Package className="h-4 w-4 mr-2" />
            Histórico de produtos · Curva A
          </Button>
          </div>
          <ToggleGroup type="single" value={periodo} onValueChange={(v) => v && setPeriodo(v as any)} variant="outline" size="sm">
            <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
            <ToggleGroupItem value="mes">Mês</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Insight do dia gerado por IA */}
        <InsightResumo mes={mes} refreshKey={refreshKey} />

        {/* Status do provedor de IA */}
        <AIProviderStatus />

        {/* ===== CARD DESTAQUE: FATURAMENTO DO MÊS ===== */}
        <section
          className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 100%)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-6 sm:gap-4">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider opacity-80 mb-1">
                {isPeriodoUnico ? `Faturamento do mês — ${mes}` : `Faturamento — ${labelPeriodo}`}
              </p>
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">{fmtBRL(kpis.fat)}</p>
              <p className="text-xs sm:text-sm opacity-90 mt-1">
                {fmtNum(kpis.vol)} kg faturados · MB {fmtPct(kpis.mbPct)} · ML {fmtPct(kpis.mlPct)}
              </p>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {kpis.metaFat > 0 && (
                <div className="bg-white/15 rounded-lg px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] opacity-80">{isPeriodoUnico ? "Meta do mês" : "Meta do período"}</p>
                  <p className="font-semibold">{fmtBRL(kpis.metaFat)}</p>
                  <p className="text-[11px] opacity-90">{fmtPct(kpis.atingFat)} atingido</p>
                </div>
              )}
              {isPeriodoUnico && fatMesAnterior > 0 && (
                <div className="bg-white/15 rounded-lg px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] opacity-80">Mês anterior ({mesAnterior})</p>
                  <p className="font-semibold">{fmtBRL(fatMesAnterior)}</p>
                  <p className="text-[11px] opacity-90">
                    {kpis.fat >= fatMesAnterior ? "▲" : "▼"} {fmtPct(Math.abs((kpis.fat - fatMesAnterior) / fatMesAnterior))}
                  </p>
                </div>
              )}
              {isMesCorrente && kpis.aberto > 0 && (
                <div className="bg-white/15 rounded-lg px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] opacity-80">Projeção c/ aberto</p>
                  <p className="font-semibold">{fmtBRL(kpis.projFat)}</p>
                  {kpis.metaFat > 0 && (
                    <p className="text-[11px] opacity-90">{fmtPct(kpis.projAtingFat)} da meta</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {reps.length === 0 && metas.length === 0 && vendas.length === 0 && (
          <section className="bg-card rounded-2xl p-5 border border-dashed" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-primary font-semibold mb-2">Planejamento ainda sem base cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Para ativar o planejamento do gestor e dos RCs, você precisa cadastrar os representantes, vincular os logins dos RCs e carregar metas/clientes da operação.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm"><Link to="/super-admin">Criar usuário RC</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/representantes">Cadastrar representantes</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/clientes">Cadastrar clientes</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to="/metas">Importar metas</Link></Button>
            </div>
          </section>
        )}

         <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
           <DashboardCard label="Faturamento" value={fmtBRL(kpis.fat)} hint={kpis.metaFat > 0 ? `${fmtPct(kpis.atingFat)} meta` : "Sem meta"} icon={TrendingUp} color="text-primary" bg="bg-primary/5" />
           <DashboardCard label="Volume (kg)" value={fmtNum(kpis.vol)} hint={kpis.metaVol > 0 ? `${fmtPct(kpis.atingVol)} meta` : undefined} icon={Package} color="text-amber-600" bg="bg-amber-50" />
           {isMesCorrente && kpis.aberto > 0 && (
             <>
               <DashboardCard
                 label="Pedidos em aberto"
                 value={fmtBRL(kpis.aberto)}
                 hint={`${fmtNum(kpis.abertoVol)} kg`}
                 icon={ShoppingBag} color="text-blue-600" bg="bg-blue-50"
               />
               <DashboardCard
                 label="Projeção"
                 value={fmtBRL(kpis.projFat)}
                 hint={kpis.metaFat > 0 ? `${fmtPct(kpis.projAtingFat)} meta` : "Sem meta"}
                 icon={Target} color="text-emerald-600" bg="bg-emerald-50"
               />
             </>
           )}
           <DashboardCard label="Margem Bruta" value={fmtPct(kpis.mbPct)} hint={fmtBRL(kpis.mb)} icon={Target} color="text-indigo-600" bg="bg-indigo-50" />
           <DashboardCard label="Margem Líquida" value={fmtPct(kpis.mlPct)} hint={fmtBRL(kpis.ml)} icon={Target} color="text-purple-600" bg="bg-purple-50" />
            <DashboardCard label="Desconto médio" value={fmtPct(kpis.desc)} icon={TrendingUp} color="text-rose-600" bg="bg-rose-50" />
            <DashboardCard label="Comissão" value={fmtBRL(kpis.comissao)} icon={ShoppingBag} color="text-teal-600" bg="bg-teal-50" />
             <div 
               className="cursor-pointer transition-transform hover:scale-[1.02]"
               onClick={() => {
                 document.getElementById('clientes-inativos')?.scrollIntoView({ behavior: 'smooth' });
               }}
             >
               <DashboardCard 
                 label="Clientes Inativos" 
                 value={String(analiseInativos.total)} 
                 hint={analiseInativos.topCidades.length > 0 ? `${analiseInativos.topCidades[0][0]}: ${analiseInativos.topCidades[0][1]}` : "Sem dados"} 
                 icon={UserX} 
                 color="text-orange-600" 
                 bg="bg-orange-50" 
               />
             </div>
          </section>

          <section id="positivacao" className="scroll-mt-24 space-y-6 mt-8">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Gestão de Positivação</h2>
            </div>
            
            <PositivacaoManager 
              stats={{
              totalClientes: analiseInativos.total + analiseInativos.ativosCount,
              ativos: analiseInativos.ativosCount,
              positivados: rankingRC.filter(r => r.fat > 0).length,
              metaPositivacao: 40,
              clientesEmRisco: analiseInativos.total

              }}
            />

            <div className="mt-4">
              <ClientesInativosCard gestorCode={gestorCode} />
            </div>
          </section>

         {/* ===== ACOMPANHAMENTO DA EQUIPE ===== */}
        <section className="bg-card rounded-2xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-primary font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Acompanhamento da Equipe
              </h3>
              <p className="text-xs text-muted-foreground">
                Score 0–100 combinando meta (40%), cumprimento do plano (25%), atividade (20%) e conversão (15%).
              </p>
            </div>
          </div>

           <div className="grid gap-4 lg:grid-cols-12">
             <div className="lg:col-span-8 grid gap-3 grid-cols-2 sm:grid-cols-3">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> RCs ativos</p>
                <p className="text-2xl font-bold text-primary">{equipeKpis.total}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Em risco</p>
                <p className="text-2xl font-bold text-destructive">{equipeKpis.emRisco}</p>
                {equipeKpis.atencao > 0 && <p className="text-[11px] text-muted-foreground">+{equipeKpis.atencao} em atenção</p>}
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Atingimento médio</p>
                <p className="text-2xl font-bold text-primary">
                  {kpis.metaFat > 0 ? fmtPct(kpis.atingFat) : "—"}
                </p>
              </div>
            </div>
            
            <div className="lg:col-span-4">
               <div className="rounded-[22px] border p-4 bg-primary text-white shadow-lg overflow-hidden relative">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <TrendingUp className="h-24 w-24" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Top Performance 360º</h4>
                  <div className="space-y-2">
                    {equipe.sort((a, b) => b.score - a.score).slice(0, 3).map((e, idx) => (
                      <div key={e.rep.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-primary-foreground/40">{idx + 1}º</span>
                          <span className="text-xs font-bold truncate max-w-[120px]">{e.rep.nome}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black">{e.score} pts</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChurnMonitor orgId={orgId} mes={mes} />
            <div className="rounded-xl border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Plano da semana</p>
              <p className="text-2xl font-bold text-primary">{equipeKpis.totalFeitos}/{equipeKpis.totalPlan}</p>
              <p className="text-[11px] text-muted-foreground">visitas realizadas por toda a equipe</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
             <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>RC</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[110px]">Score</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  {isMesCorrente && <TableHead className="text-right">Fat. Pedidos</TableHead>}
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">% Atg</TableHead>
                  <TableHead className="text-right">MB %</TableHead>
                  <TableHead className="text-right">ML %</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-center">Plano sem.</TableHead>
                   <TableHead className="text-center">Atividades</TableHead>
                   <TableHead className="text-center">Carteira %</TableHead>
                   <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipe.length === 0 ? (
                  <TableRow><TableCell colSpan={isMesCorrente ? 13 : 12} className="text-center text-muted-foreground py-6">Sem representantes cadastrados.</TableCell></TableRow>
                ) : equipe.map((e) => (
                  <TableRow
                    key={e.rep.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setDrilldown({ rcUserId: e.rep.auth_user_id, nome: e.rep.nome, cod_rc: e.rep.cod_rc })}
                  >
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {e.rep.nome}
                        {e.rep.status === "sem_cadastro" && (
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-500 text-amber-600">
                            sem cadastro
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{e.rep.cod_rc ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setScoreAnalise({
                            nome: e.rep.nome,
                            cod_rc: e.rep.cod_rc,
                            fatRC: e.fatRC,
                            abertoRC: e.abertoRC,
                            metaRC: e.metaRC,
                            atingPct: e.atingPct,
                            planTotal: e.planTotal,
                            planFeitos: e.planFeitos,
                            cumprimentoPct: e.cumprimentoPct,
                            totalInter: e.totalInter,
                            atividadePct: e.atividadePct,
                            conversaoPct: e.conversaoPct,
                            score: e.score,
                            nivel: e.nivel,
                            acoesRC: e.acoesRC,
                            diasUteisRest: e.diasUteisRest,
                          });
                        }}
                        title="Ver análise do score"
                      >
                        <Badge
                          variant={e.nivel === "risco" ? "destructive" : e.nivel === "atencao" ? "default" : "secondary"}
                          className="text-[10px] cursor-pointer hover:opacity-80"
                        >
                          {e.nivel === "risco" ? "Risco" : e.nivel === "atencao" ? "Atenção" : "OK"}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={e.score} className="h-2 flex-1" />
                        <span className="text-xs font-mono w-8 text-right">{e.score}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs">{e.fatRC > 0 ? fmtBRL(e.fatRC) : "—"}</TableCell>
                    {isMesCorrente && (
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {e.abertoRC > 0 ? fmtBRL(e.abertoRC) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-xs">{e.metaRC > 0 ? fmtBRL(e.metaRC) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {e.metaRC > 0 ? (
                        <span className={e.atingPct >= 1 ? "text-primary font-semibold" : ""}>{fmtPct(e.atingPct)}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs" title={e.mbRC ? fmtBRL(e.mbRC) : undefined}>
                      {e.fatBaseRC > 0 ? fmtPct(e.mbPctRC) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs" title={e.mlRC ? fmtBRL(e.mlRC) : undefined}>
                      {e.fatBaseRC > 0 ? fmtPct(e.mlPctRC) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {e.comissaoRC > 0 ? fmtBRL(e.comissaoRC) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {e.planTotal > 0 ? `${e.planFeitos}/${e.planTotal}` : "—"}
                    </TableCell>
                     <TableCell className="text-center text-xs">{e.totalInter}</TableCell>
                     <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-5",
                          e.saudeCarteiraPct > 0.7 ? "border-emerald-200 text-emerald-600" :
                          e.saudeCarteiraPct > 0.4 ? "border-amber-200 text-amber-600" :
                          "border-rose-200 text-rose-600"
                        )}>
                          {Math.round(e.saudeCarteiraPct * 100)}%
                        </Badge>
                     </TableCell>
                     <TableCell className="text-center">
                      {e.acoesRC > 0 && <Badge variant="outline" className="text-[10px]">{e.acoesRC}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {equipe.length > 0 && (() => {
                  const tFat = equipe.reduce((s, e) => s + e.fatRC, 0);
                  const tAberto = equipe.reduce((s, e) => s + e.abertoRC, 0);
                  const tMeta = equipe.reduce((s, e) => s + e.metaRC, 0);
                  const tFatBase = equipe.reduce((s, e) => s + e.fatBaseRC, 0);
                  const tMb = equipe.reduce((s, e) => s + e.mbRC, 0);
                  const tMl = equipe.reduce((s, e) => s + e.mlRC, 0);
                  const tCom = equipe.reduce((s, e) => s + e.comissaoRC, 0);
                  const tPlanTot = equipe.reduce((s, e) => s + e.planTotal, 0);
                  const tPlanFeitos = equipe.reduce((s, e) => s + e.planFeitos, 0);
                  const tInter = equipe.reduce((s, e) => s + e.totalInter, 0);
                  return (
                    <TableRow className="bg-muted/50 font-semibold border-t-2">
                      <TableCell className="text-xs">TOTAL / Média ponderada</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right text-xs">{fmtBRL(tFat)}</TableCell>
                      {isMesCorrente && <TableCell className="text-right text-xs">{fmtBRL(tAberto)}</TableCell>}
                      <TableCell className="text-right text-xs">{tMeta > 0 ? fmtBRL(tMeta) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{tMeta > 0 ? fmtPct(tFat / tMeta) : "—"}</TableCell>
                      <TableCell className="text-right text-xs" title={fmtBRL(tMb)}>{tFatBase > 0 ? fmtPct(tMb / tFatBase) : "—"}</TableCell>
                      <TableCell className="text-right text-xs" title={fmtBRL(tMl)}>{tFatBase > 0 ? fmtPct(tMl / tFatBase) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{fmtBRL(tCom)}</TableCell>
                      <TableCell className="text-center text-xs">{tPlanTot > 0 ? `${tPlanFeitos}/${tPlanTot}` : "—"}</TableCell>
                      <TableCell className="text-center text-xs">{tInter}</TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">Clique em um RC para ver plano semanal, SMART, atividades e registrar ações.</p>
        </section>

        <section className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-primary font-semibold mb-4">
            Ranking de Representantes — {mes}
            {isMesCorrente && kpis.aberto > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-2">· inclui pedidos em aberto</span>
            )}
          </h3>
          <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RC</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  {isMesCorrente && <TableHead className="text-right">Aberto</TableHead>}
                  {isMesCorrente && <TableHead className="text-right">Projeção</TableHead>}
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">% Atingido</TableHead>
                  {isMesCorrente && <TableHead className="text-right">% Projeção</TableHead>}
                  <TableHead className="text-right">MB R$</TableHead>
                  <TableHead className="text-right">ML R$</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankingRC.length === 0 ? (
                  <TableRow><TableCell colSpan={isMesCorrente ? 11 : 8} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                ) : rankingRC.map((r) => (
                  <TableRow key={r.cod_rc}>
                    <TableCell className="font-mono text-xs">{r.cod_rc}</TableCell>
                    <TableCell>{r.nome}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.fat)}</TableCell>
                    {isMesCorrente && (
                      <TableCell className="text-right text-muted-foreground">
                        {r.aberto > 0 ? fmtBRL(r.aberto) : "—"}
                      </TableCell>
                    )}
                    {isMesCorrente && (
                      <TableCell className="text-right">{fmtBRL(r.fat + r.aberto)}</TableCell>
                    )}
                    <TableCell className="text-right">{r.meta > 0 ? fmtBRL(r.meta) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.meta > 0 ? (
                        <span className={r.fat / r.meta >= 1 ? "text-primary font-semibold" : "text-muted-foreground"}>
                          {fmtPct(r.fat / r.meta)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    {isMesCorrente && (
                      <TableCell className="text-right">
                        {r.meta > 0 ? (
                          <span className={(r.fat + r.aberto) / r.meta >= 1 ? "text-primary font-semibold" : "text-muted-foreground"}>
                            {fmtPct((r.fat + r.aberto) / r.meta)}
                          </span>
                        ) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">{fmtBRL(r.mb)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.ml)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(r.comissao)}</TableCell>
                  </TableRow>
                ))}
                {rankingRC.length > 0 && (() => {
                  const tFat = rankingRC.reduce((s, r) => s + r.fat, 0);
                  const tAberto = rankingRC.reduce((s, r) => s + r.aberto, 0);
                  const tMeta = rankingRC.reduce((s, r) => s + r.meta, 0);
                  const tMb = rankingRC.reduce((s, r) => s + r.mb, 0);
                  const tMl = rankingRC.reduce((s, r) => s + r.ml, 0);
                  const tCom = rankingRC.reduce((s, r) => s + r.comissao, 0);
                  return (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      <TableCell className="text-right">{fmtBRL(tFat)}</TableCell>
                      {isMesCorrente && <TableCell className="text-right">{fmtBRL(tAberto)}</TableCell>}
                      {isMesCorrente && <TableCell className="text-right">{fmtBRL(tFat + tAberto)}</TableCell>}
                      <TableCell className="text-right">{tMeta > 0 ? fmtBRL(tMeta) : "—"}</TableCell>
                      <TableCell className="text-right">{tMeta > 0 ? fmtPct(tFat / tMeta) : "—"}</TableCell>
                      {isMesCorrente && <TableCell className="text-right">{tMeta > 0 ? fmtPct((tFat + tAberto) / tMeta) : "—"}</TableCell>}
                      <TableCell className="text-right">{fmtBRL(tMb)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(tMl)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(tCom)}</TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="bg-card rounded-2xl p-5 overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-primary font-semibold mb-4 px-1">Faturamento por Linha</h3>
            <div className="overflow-x-auto -mx-5 px-5">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead className="text-right">Fat.</TableHead>
                  {isMesCorrente && <TableHead className="text-right">+ Aberto</TableHead>}
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">% {isMesCorrente ? "Proj" : "Atg"}</TableHead>
                  <TableHead className="text-right">MB R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porLinha.length === 0 ? (
                  <TableRow><TableCell colSpan={isMesCorrente ? 6 : 5} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                ) : porLinha.map((l) => (
                  <TableRow key={l.linha}>
                    <TableCell>{l.linha}</TableCell>
                    <TableCell className="text-right">{fmtBRL(l.fat)}</TableCell>
                    {isMesCorrente && (
                      <TableCell className="text-right text-muted-foreground">
                        {l.aberto > 0 ? fmtBRL(l.aberto) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">{l.meta > 0 ? fmtBRL(l.meta) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {l.meta > 0 ? (
                        <span className={(l.fat + (isMesCorrente ? l.aberto : 0)) / l.meta >= 1 ? "text-primary font-semibold" : ""}>
                          {fmtPct((l.fat + (isMesCorrente ? l.aberto : 0)) / l.meta)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(l.mb)}</TableCell>
                  </TableRow>
                ))}
                {porLinha.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{fmtBRL(kpis.fat)}</TableCell>
                    {isMesCorrente && <TableCell className="text-right">{fmtBRL(kpis.aberto)}</TableCell>}
                    <TableCell className="text-right">{kpis.metaFat > 0 ? fmtBRL(kpis.metaFat) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {kpis.metaFat > 0 ? fmtPct((kpis.fat + (isMesCorrente ? kpis.aberto : 0)) / kpis.metaFat) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(kpis.mb)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-primary font-semibold mb-4 px-1">Top 10 Clientes</h3>
            <div className="overflow-x-auto -mx-5 px-5">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Fat.</TableHead>
                  <TableHead className="text-right">MB R$</TableHead>
                  <TableHead className="text-right">ML R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClientes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados.</TableCell></TableRow>
                ) : topClientes.map((c) => (
                  <TableRow key={c.cliente}>
                    <TableCell className="max-w-[260px] truncate">{c.cliente}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.fat)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.mb)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(c.ml)}</TableCell>
                  </TableRow>
                ))}
                {topClientes.length > 0 && (() => {
                  const tFat = topClientes.reduce((s, c) => s + c.fat, 0);
                  const tMb = topClientes.reduce((s, c) => s + c.mb, 0);
                  const tMl = topClientes.reduce((s, c) => s + c.ml, 0);
                  return (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL (Top 10)</TableCell>
                      <TableCell className="text-right">{fmtBRL(tFat)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(tMb)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(tMl)}</TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
              </Table>
            </div>
          </div>
        </section>
      </div>

      <RcDrilldownDialog
        open={!!drilldown}
        onOpenChange={(o) => { if (!o) setDrilldown(null); }}
        rcUserId={drilldown?.rcUserId ?? null}
        rcNome={drilldown?.nome ?? ""}
        codRc={drilldown?.cod_rc ?? null}
        mes={mes}
      />

      <HistoricoProdutosDialog open={openProdutos} onClose={() => setOpenProdutos(false)} />

      <ScoreAnaliseDialog
        open={!!scoreAnalise}
        onOpenChange={(o) => { if (!o) setScoreAnalise(null); }}
        data={scoreAnalise}
      />

       <section className="bg-card rounded-2xl p-5 mt-5" style={{ boxShadow: "var(--shadow-card)" }}>
         <h3 className="text-primary font-semibold mb-4">Alertas comerciais — {mes}</h3>
         <p className="text-xs text-muted-foreground mb-4">
           Alertas automáticos a partir das vendas: clientes sem compra, risco de inatividade, inativos 6+ meses e quedas de consumo. Os RCs respondem com motivo e plano de ação.
         </p>
         <AlertasGestor mes={mes} />
       </section>

       <section className="bg-card rounded-2xl p-5 mt-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-primary font-semibold mb-1">Insights de IA — análise profunda</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Diagnóstico completo da carteira, projeção de metas, RCs em risco e plano de ação recomendado.
        </p>
        <InsightsCompletos mes={mes} refreshKey={refreshKey} />
      </section>
    </>
  );
};

export default Gerencial;