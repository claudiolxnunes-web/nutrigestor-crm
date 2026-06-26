import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = {
  provider: "openai" | "lovable" | "none";
  model: string;
  authStatus: "ok" | "invalid" | "no_credits" | "missing" | "error";
  message: string;
};

export function AIProviderStatus() {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data: res } = await supabase.functions.invoke("ai-provider-status", { body: {} });
    setData((res as Status) ?? null);
    setLoading(false);
  };

  useEffect(() => { void carregar(); }, []);

  const providerLabel =
    data?.provider === "openai" ? "OpenAI (sua chave)" :
    data?.provider === "lovable" ? "Gemini (Lovable AI)" : "Nenhum";

  const statusBadge = () => {
    if (loading) return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verificando…</Badge>;
    if (!data) return <Badge variant="destructive">Sem resposta</Badge>;
    switch (data.authStatus) {
      case "ok":
        return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Autenticado</Badge>;
      case "invalid":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Chave inválida</Badge>;
      case "no_credits":
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 gap-1"><AlertTriangle className="h-3 w-3" /> Sem créditos</Badge>;
      case "missing":
        return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Não configurado</Badge>;
      default:
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-accent/30 to-background border-primary/10">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Status da Infraestrutura de IA</p>
            <Button size="sm" variant="ghost" onClick={carregar} disabled={loading} className="h-6 px-2">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-medium">Configuração atual: {providerLabel}</span>
            {data?.model && <span className="text-xs text-muted-foreground">· {data.model}</span>}
            {statusBadge()}
          </div>
          <p className="text-xs text-muted-foreground">
            {data?.message ?? "Consultando provedor…"} 
            {data?.provider === "openai" && " (O seletor acima permite alternar para outros modelos se sua chave OpenAI estiver com limite)"}
          </p>
        </div>
      </div>
    </Card>
  );
}