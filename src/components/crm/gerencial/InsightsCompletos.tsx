import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
 import { Sparkles, RefreshCw, Loader2, Brain, AlertTriangle, Target, TrendingUp, Users, Activity, LogOut, CheckCircle2, ChevronRight, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useRcMap, renderTextoComLinksRc, type RcEntry } from "./useRcMap";
 import { RcDrilldownDialog } from "./RcDrilldownDialog";
 import { CarteiraDrilldownDialog } from "./CarteiraDrilldownDialog";
import { toFriendlyAiError, classifyAiError } from "@/lib/aiErrors";

type Props = { mes: string; refreshKey?: number };

const CACHE_TTL_MS = 5 * 60 * 1000;
const normalizeProvider = (value: string | null) => value === "openai" ? "openai" : "gemini";

export function InsightsCompletos({ mes, refreshKey = 0 }: Props) {
  const [insight, setInsight] = useState<string>("");
  const [contexto, setContexto] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [geradoEm, setGeradoEm] = useState<Date | null>(null);
  const [provider, setProvider] = useState<string>(() => normalizeProvider(localStorage.getItem("ai_provider")));
  const { reps, findRc } = useRcMap();
  const [drillRc, setDrillRc] = useState<RcEntry | null>(null);
  const [drillCarteira, setDrillCarteira] = useState<"total" | "ativos" | "inativos" | "positivados" | null>(null);
  const cacheKey = useMemo(() => `insight_completo_v2_${mes}_${provider}`, [mes, provider]);

  const abrirRc = (rc: RcEntry | null) => {
    if (!rc) { toast.info("RC não vinculado a usuário"); return; }
    if (!rc.auth_user_id) { toast.info(`${rc.nome} ainda não tem login vinculado`); return; }
    setDrillRc(rc);
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    localStorage.setItem("ai_provider", newProvider);
    toast.success(`Provedor alterado para ${newProvider}`);
  };

  // Wrapper que injeta links nos nós de texto dentro do markdown
  const linkifyChildren = (children: React.ReactNode, key: string): React.ReactNode => {
    if (typeof children === "string") return renderTextoComLinksRc(children, reps, (r) => abrirRc(r), key);
    if (Array.isArray(children)) {
      return children.map((c, i) =>
        typeof c === "string"
          ? <React.Fragment key={`${key}-${i}`}>{renderTextoComLinksRc(c, reps, (r) => abrirRc(r), `${key}-${i}`)}</React.Fragment>
          : c
      );
    }
    return children;
  };

  const pollJob = async (jobId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s
    
    const interval = setInterval(async () => {
      attempts++;
      const { data, error } = await supabase.functions.invoke("gestor-insights-ia-queue", {
        body: { action: "poll", jobId }
      });

      if (error || data?.status === "failed") {
        clearInterval(interval);
        setPolling(false);
        setLoading(false);
        const fe = classifyAiError(data?.error_message || "Erro na fila", provider);
        toast.error(fe.title, { description: fe.description });
        return;
      }

      if (data?.status === "completed") {
        clearInterval(interval);
        setInsight(data.insight);
        setContexto(data.contexto);
        const agora = new Date();
        setGeradoEm(agora);
        setPolling(false);
        setLoading(false);
        sessionStorage.setItem(cacheKey, JSON.stringify({
          insight: data.insight,
          contexto: data.contexto,
          geradoEm: agora.toISOString(),
          expiresAt: Date.now() + CACHE_TTL_MS,
        }));
        toast.success("Análise completa disponível");
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPolling(false);
        setLoading(false);
        toast.error("Tempo esgotado", { description: "A geração está demorando mais que o esperado. Tente atualizar a página em alguns instantes." });
      }
    }, 2000);
  };

  const carregar = async (forcar = false) => {
    if (loading || polling) return;
    
    if (!forcar) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { insight?: string; contexto?: any; geradoEm?: string; expiresAt?: number };
          if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
            setInsight(parsed.insight ?? "");
            setContexto(parsed.contexto ?? null);
            setGeradoEm(parsed.geradoEm ? new Date(parsed.geradoEm) : null);
            return;
          }
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gestor-insights-ia-queue", {
      body: { action: "enqueue", mes, modo: "completo", provider }
    });

    if (error) {
      setLoading(false);
      const fe = await toFriendlyAiError(error, data, provider);
      toast.error(fe.title, { description: fe.description });
      return;
    }

    if (data?.status === "completed" && data?.jobId) {
      // Reusing cached result from DB
      const { data: jobData } = await supabase.functions.invoke("gestor-insights-ia-queue", {
        body: { action: "poll", jobId: data.jobId }
      });
      if (jobData?.status === "completed") {
        setInsight(jobData.insight);
        setContexto(jobData.contexto);
        setGeradoEm(new Date());
        setLoading(false);
        return;
      }
    }

    if (data?.jobId) {
      pollJob(data.jobId);
    }
  };

  useEffect(() => { void carregar(false); }, [mes]);
  useEffect(() => {
    if (refreshKey === 0) return;
    void carregar(true);
  }, [refreshKey]);

   const renderVariação = (varObj: any, isPercent = false) => {
     if (!varObj) return null;
     const { absoluta, percentual } = varObj;
     const isPositive = absoluta > 0;
     const isZero = absoluta === 0;
     
     if (isZero) return <span className="text-[9px] text-muted-foreground ml-1.5 font-medium">--</span>;
 
     return (
       <div className={`flex items-center gap-0.5 ml-1.5 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
         {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
         <span className="text-[9px] font-bold">
           {isPositive ? '+' : ''}{isPercent ? (absoluta * 100).toFixed(1) + '%' : absoluta} ({percentual})
         </span>
       </div>
     );
   };
 
   return (
     <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/20 border-primary/20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Análise inteligente da operação</h3>
              <p className="text-xs text-muted-foreground">
                IA cruza carteira, metas, alertas e atividade dos RCs
                {geradoEm && ` · gerado às ${geradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={provider} 
              onChange={(e) => handleProviderChange(e.target.value)}
              className="text-[10px] h-8 bg-background border rounded px-2 font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="gemini">Gemini (2.5 Flash)</option>
              <option value="openai">OpenAI (GPT-4o mini)</option>
            </select>
            <Button size="sm" onClick={() => carregar(true)} disabled={loading || polling} variant="outline" className="h-8">
              {(loading || polling) ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              {polling ? "Processando..." : "Refazer análise"}
            </Button>
          </div>
        </div>
      </Card>

       {/* KPIs da Carteira Flutuante */}
       {contexto?.estatisticas_carteira && (
         <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
           <Card 
             className="p-3 bg-white/40 backdrop-blur-sm border-primary/10 cursor-pointer hover:bg-white/60 transition-colors group relative"
             onClick={() => setDrillCarteira("total")}
           >
             <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
               <Users className="h-3 w-3" /> Total Cadastrados
             </p>
             <div className="flex items-baseline">
               <p className="text-xl font-bold">{contexto.estatisticas_carteira.total_cadastrados}</p>
             </div>
             <ChevronRight className="h-3 w-3 absolute bottom-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity" />
           </Card>
           <Card 
             className="p-3 bg-white/40 backdrop-blur-sm border-primary/10 cursor-pointer hover:bg-white/60 transition-colors group relative"
             onClick={() => setDrillCarteira("ativos")}
           >
             <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
               <Activity className="h-3 w-3 text-emerald-500" /> Ativos (6m)
             </p>
             <div className="flex items-baseline">
               <p className="text-xl font-bold text-emerald-600">{contexto.estatisticas_carteira.ativos_ultimos_6_meses}</p>
               {renderVariação(contexto.estatisticas_carteira.comparativo?.ativos)}
             </div>
             <ChevronRight className="h-3 w-3 absolute bottom-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity" />
           </Card>
           <Card 
             className="p-3 bg-white/40 backdrop-blur-sm border-primary/10 cursor-pointer hover:bg-white/60 transition-colors group relative"
             onClick={() => setDrillCarteira("inativos")}
           >
             <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
               <LogOut className="h-3 w-3 text-amber-500" /> Inativos (+6m)
             </p>
             <div className="flex items-baseline">
               <p className="text-xl font-bold text-amber-600">{contexto.estatisticas_carteira.inativos_mais_6_meses}</p>
               {renderVariação(contexto.estatisticas_carteira.comparativo?.inativos)}
             </div>
             <ChevronRight className="h-3 w-3 absolute bottom-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity" />
           </Card>
           <Card 
             className="p-3 bg-white/40 backdrop-blur-sm border-primary/10 cursor-pointer hover:bg-white/60 transition-colors group relative"
             onClick={() => setDrillCarteira("positivados")}
           >
             <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
               <CheckCircle2 className="h-3 w-3 text-blue-500" /> Positivados Mês
             </p>
             <div className="flex items-baseline">
               <p className="text-xl font-bold text-blue-600">{contexto.estatisticas_carteira.positivados_no_mes}</p>
               {renderVariação(contexto.estatisticas_carteira.comparativo?.positivados)}
             </div>
             <ChevronRight className="h-3 w-3 absolute bottom-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity" />
           </Card>
           <Card className="p-3 bg-primary/5 border-primary/20">
             <p className="text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-1">
               <Target className="h-3 w-3" /> Índice Positivação
             </p>
             <div className="flex items-baseline">
               <p className="text-xl font-bold text-primary">{contexto.estatisticas_carteira.indice_positivacao_carteira}</p>
               {renderVariação(contexto.estatisticas_carteira.comparativo?.indice, true)}
             </div>
           </Card>
         </section>
       )}
       <CarteiraDrilldownDialog
         open={!!drillCarteira}
         onOpenChange={(o) => !o && setDrillCarteira(null)}
         tipo={drillCarteira}
         clientes={contexto?.estatisticas_carteira?.detalhes_clientes ?? []}
         mes={mes}
       />
 

      {/* Snapshot factual */}
      {contexto && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Atingimento</p>
            <p className="text-xl font-bold text-primary">{contexto.atingimento_atual}</p>
            <p className="text-[11px] text-muted-foreground">Esperado: {contexto.esperado_ate_hoje_pct}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Projeção fim do mês</p>
            <p className="text-xl font-bold">{contexto.projecao_fim_mes}</p>
            <p className="text-[11px] text-muted-foreground">Gap: {contexto.gap_vs_meta}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> RCs em risco</p>
            <p className="text-xl font-bold text-destructive">{contexto.rcs_em_risco?.length ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">de {contexto.total_rcs} ativos</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Alertas pendentes</p>
            <p className="text-xl font-bold">{contexto.alertas_pendentes}</p>
            {contexto.alertas_com_sla_vencido > 0 && (
              <p className="text-[11px] text-destructive">⚠️ {contexto.alertas_com_sla_vencido} SLA vencido</p>
            )}
          </Card>
        </section>
      )}

      {/* Análise IA */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="font-semibold">Diagnóstico e plano de ação</h4>
        </div>
        {(loading || polling) && !insight ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">{polling ? "Fila de processamento: gerando insights..." : "Iniciando análise..."}</p>
          </div>
        ) : insight ? (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p>{linkifyChildren(children, "p")}</p>,
                li: ({ children }) => <li>{linkifyChildren(children, "li")}</li>,
                strong: ({ children }) => <strong>{linkifyChildren(children, "s")}</strong>,
                em: ({ children }) => <em>{linkifyChildren(children, "e")}</em>,
              }}
            >
              {insight}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda.</p>
        )}
      </Card>

      <div className="flex items-center justify-center gap-4 py-2 border-t border-dashed opacity-60">
        <p className="text-[10px] text-muted-foreground italic">
          💡 Dica: Resultados são armazenados por 15 min para economizar créditos.
        </p>
        <button 
          onClick={() => window.open('/settings', '_blank')}
          className="text-[10px] text-primary hover:underline font-medium"
        >
          Configurar chave própria de IA
        </button>
      </div>

      {/* Detalhes por RC em risco */}
      {contexto?.rcs_em_risco?.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> RCs com risco de não bater meta
          </h4>
          <div className="space-y-2">
            {contexto.rcs_em_risco.map((r: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => abrirRc(findRc({ codRc: r.cod_rc, nome: r.nome }))}
                className="w-full flex items-center justify-between text-sm border-l-2 border-destructive/40 pl-3 py-1 hover:bg-accent/40 rounded-r transition-colors text-left group"
              >
                <div>
                  <p className="font-medium group-hover:text-primary group-hover:underline decoration-dotted underline-offset-2">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">Atingimento: {r.atingimento} · clique para abrir</p>
                </div>
                <Badge variant="destructive" className="text-[10px]">Gap: {r.gap_projetado}</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      <RcDrilldownDialog
        open={!!drillRc}
        onOpenChange={(o) => !o && setDrillRc(null)}
        rcUserId={drillRc?.auth_user_id ?? null}
        rcNome={drillRc?.nome ?? ""}
        codRc={drillRc?.cod_rc ?? null}
        mes={mes}
      />
    </div>
  );
}