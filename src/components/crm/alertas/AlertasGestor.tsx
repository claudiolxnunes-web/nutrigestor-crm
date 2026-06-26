import { useEffect, useState } from "react";
import { format, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { AlertaCard, Alerta } from "./AlertaCard";
import { toast } from "sonner";

const TIPO_LABEL: Record<string, string> = {
  sem_compra_mes: "Sem compra no mês",
  risco_inatividade: "Risco de inatividade",
  inativo_6m: "Inativo 6+ meses",
  queda_consumo: "Queda de consumo",
};

const CATEGORIA_LABEL: Record<string, string> = {
  comercial: "Comercial",
  logistica: "Logística",
  produto: "Produto",
  cliente: "Cliente",
  outro: "Outro",
};

export function AlertasGestor({ mes }: { mes: string }) {
  const { orgId } = useOrg();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [escalando, setEscalando] = useState(false);
  const [filtro, setFiltro] = useState<"pendentes" | "respondidos" | "todos">("pendentes");
  const [filtroRc, setFiltroRc] = useState<string>("");

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase.from("alertas_rc")
      .select("*, rc_nome, user_id")
      .eq("organizacao_id", orgId)
      .eq("mes_referencia", mes)
      .order("created_at", { ascending: false });
    setAlertas((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId, mes]);

  const gerar = async () => {
    if (!orgId) return;
    setGerando(true);
    const { error } = await supabase.rpc("gerar_alertas_rc" as any, { _org_id: orgId, _mes_ano: mes });
    setGerando(false);
    if (error) return toast.error(error.message);
    toast.success("Alertas gerados");
    load();
  };

  const recalcular = async () => {
    if (!orgId) return;
    setRecalculando(true);
    const { data, error } = await supabase.rpc("fechar_alertas_recuperados" as any, { _org_id: orgId });
    setRecalculando(false);
    if (error) return toast.error(error.message);
    const r: any = data ?? {};
    toast.success(`✅ ${r.recuperados ?? 0} recuperados, ❌ ${r.perdidos ?? 0} marcados como perdidos`);
    load();
  };

  const escalarVencidos = async () => {
    if (!orgId) return;
    setEscalando(true);
    const { data, error } = await supabase.rpc("escalar_alertas_sla_vencido" as any, { _org_id: orgId });
    setEscalando(false);
    if (error) return toast.error(error.message);
    const r: any = data ?? {};
    if (r.erro) return toast.error(r.erro);
    if ((r.escalados ?? 0) === 0) toast.info("Nenhum alerta com SLA vencido");
    else toast.success(`⚡ ${r.escalados} alertas escalados — tarefas criadas para o gestor`);
    load();
  };

  // Métricas agregadas
  const totalPendentes = alertas.filter((a) => a.status === "pendente").length;
  const totalVencidos = alertas.filter((a) => a.status === "pendente" && a.prazo_resposta && new Date(a.prazo_resposta) < new Date(new Date().toDateString())).length;
  const totalEscalados = alertas.filter((a) => a.status === "escalado").length;
  const totalEmTratativa = alertas.filter((a) => ["em_tratativa", "respondido"].includes(a.status)).length;
  const totalRecuperados = alertas.filter((a) => a.status === "recuperado").length;
  const totalPerdidos = alertas.filter((a) => a.status === "perdido").length;
  const totalTratados = alertas.filter((a) => a.status !== "pendente").length;
  const taxaResposta = alertas.length > 0 ? (totalTratados / alertas.length) * 100 : 0;

  // Top motivos
  const motivosMap = new Map<string, number>();
  alertas.filter((a) => a.motivo_categoria).forEach((a) => {
    const k = a.motivo_categoria!;
    motivosMap.set(k, (motivosMap.get(k) ?? 0) + 1);
  });
  const topMotivos = Array.from(motivosMap.entries()).sort((a, b) => b[1] - a[1]);

  // Lista RCs únicos
  const rcs = Array.from(new Set(alertas.map((a: any) => a.rc_nome).filter(Boolean))) as string[];

  let lista = alertas;
  if (filtro === "pendentes") lista = lista.filter((a) => a.status === "pendente");
  if (filtro === "respondidos") lista = lista.filter((a) => a.status !== "pendente");
  if (filtroRc) lista = lista.filter((a: any) => a.rc_nome === filtroRc);

  return (
    <div className="space-y-4">
      {/* KPIs */}
       <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total alertas</p>
          <p className="text-2xl font-bold">{alertas.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Pendentes</p>
          <p className="text-2xl font-bold text-destructive">{totalPendentes}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Em tratativa</p>
          <p className="text-2xl font-bold text-primary">{totalEmTratativa}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Recuperados</p>
          <p className="text-2xl font-bold text-primary">{totalRecuperados}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Perdidos</p>
          <p className="text-2xl font-bold">{totalPerdidos}</p>
        </Card>
      </section>
      <p className="text-xs text-muted-foreground -mt-2">
        Taxa de resposta: <span className="font-semibold">{taxaResposta.toFixed(0)}%</span>
        {totalVencidos > 0 && <span className="ml-3 text-destructive">⚠️ {totalVencidos} com SLA vencido</span>}
        {totalEscalados > 0 && <span className="ml-3">⚡ {totalEscalados} escalados</span>}
      </p>

      {/* Top motivos */}
      {topMotivos.length > 0 && (
        <Card className="p-3">
          <p className="text-sm font-semibold mb-2">Motivos mais frequentes</p>
          <div className="flex flex-wrap gap-2">
            {topMotivos.map(([cat, n]) => (
              <Badge key={cat} variant="outline" className="text-xs">
                {CATEGORIA_LABEL[cat] ?? cat}: <span className="ml-1 font-semibold">{n}</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button onClick={gerar} disabled={gerando} size="sm">
          {gerando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Gerar alertas do mês
        </Button>
        <Button onClick={recalcular} disabled={recalculando} size="sm" variant="outline">
          {recalculando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Recalcular status
        </Button>
        <Button onClick={escalarVencidos} disabled={escalando} size="sm" variant={totalVencidos > 0 ? "destructive" : "outline"}>
          {escalando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
          Escalar SLA vencidos{totalVencidos > 0 ? ` (${totalVencidos})` : ""}
        </Button>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="pendentes">Pendentes</option>
          <option value="respondidos">Respondidos</option>
          <option value="todos">Todos</option>
        </select>
        {rcs.length > 0 && (
          <select
            value={filtroRc}
            onChange={(e) => setFiltroRc(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os RCs</option>
            {rcs.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <Card className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></Card>
      ) : lista.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum alerta encontrado. Clique em "Gerar alertas do mês" para criá-los a partir das vendas.
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((a: any) => (
            <div key={a.id}>
              {a.rc_nome && (
                <p className="text-[11px] text-muted-foreground mb-1 ml-1">RC: <span className="font-semibold">{a.rc_nome}</span></p>
              )}
              <AlertaCard alerta={a} readonly onRespondido={load} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}