import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRcMap, renderTextoComLinksRc, type RcEntry } from "./useRcMap";
import { RcDrilldownDialog } from "./RcDrilldownDialog";
import { toFriendlyAiError, classifyAiError } from "@/lib/aiErrors";

type Props = { mes: string; refreshKey?: number };

const CACHE_TTL_MS = 5 * 60 * 1000;
const normalizeProvider = (value: string | null) => value === "openai" ? "openai" : "gemini";

export function InsightResumo({ mes, refreshKey = 0 }: Props) {
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const { reps, findRc } = useRcMap();
  const [drillRc, setDrillRc] = useState<RcEntry | null>(null);
  const [provider, setProvider] = useState<string>(() => normalizeProvider(localStorage.getItem("ai_provider")));

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    localStorage.setItem("ai_provider", newProvider);
    toast.success(`Provedor alterado para ${newProvider}`);
  };
  const cacheKey = useMemo(() => `insight_resumo_v2_${mes}_${provider}`, [mes, provider]);

  const abrirRc = (rc: RcEntry) => {
    if (!rc.auth_user_id) return;
    setDrillRc(rc);
  };

  const pollJob = async (jobId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 30;
    
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
        setPolling(false);
        setLoading(false);
        sessionStorage.setItem(cacheKey, JSON.stringify({
          insight: data.insight,
          expiresAt: Date.now() + CACHE_TTL_MS,
        }));
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPolling(false);
        setLoading(false);
        toast.error("Tempo esgotado", { description: "A geração do insight curto está demorando. Tente atualizar a página." });
      }
    }, 2000);
  };

  const carregar = async (forcar = false) => {
    if (loading || polling) return;
    if (!forcar) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { insight?: string; expiresAt?: number };
          if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
            setInsight(parsed.insight ?? "");
            return;
          }
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gestor-insights-ia-queue", {
      body: { action: "enqueue", mes, modo: "resumo", provider }
    });

    if (error) {
      setLoading(false);
      const fe = await toFriendlyAiError(error, data, provider);
      toast.error(fe.title, { description: fe.description });
      return;
    }

    if (data?.status === "completed" && data?.jobId) {
      const { data: jobData } = await supabase.functions.invoke("gestor-insights-ia-queue", {
        body: { action: "poll", jobId: data.jobId }
      });
      if (jobData?.status === "completed") {
        setInsight(jobData.insight);
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

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/30 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Insight do dia · IA</p>
            <div className="flex items-center gap-2">
              <select 
                value={provider} 
                onChange={(e) => handleProviderChange(e.target.value)}
                className="text-[10px] h-6 bg-background border rounded px-1.5 font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
              <Button size="sm" variant="ghost" onClick={() => carregar(true)} disabled={loading || polling} className="h-6 px-2">
                {(loading || polling) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          {(loading || polling) && !insight ? (
            <p className="text-sm text-muted-foreground italic">{(loading || polling) ? "Consultando IA (fila)..." : "Analisando carteira e metas…"}</p>
          ) : (
            <p className="text-sm leading-relaxed">
              {insight ? renderTextoComLinksRc(insight, reps, abrirRc, "resumo") : "Sem dados suficientes para gerar insight."}
            </p>
          )}
        </div>
      </div>
      <RcDrilldownDialog
        open={!!drillRc}
        onOpenChange={(o) => !o && setDrillRc(null)}
        rcUserId={drillRc?.auth_user_id ?? null}
        rcNome={drillRc?.nome ?? ""}
        codRc={drillRc?.cod_rc ?? null}
        mes={mes}
      />
    </Card>
  );
}