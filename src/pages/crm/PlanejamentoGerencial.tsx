import { useEffect, useMemo, useState } from "react";
import { Plus, Target, Trash2, Edit2, Check, ClipboardList, Filter, TrendingUp, CalendarRange, Download, FileText, RefreshCw, Info, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
 import { useRole } from "@/hooks/useRole";
 import { crmService } from "@/services/crmService";
 import { PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MesMultiSelect } from "@/components/crm/MesMultiSelect";
import { Seo } from "@/components/Seo";

const PILARES = [
  { value: "comercial", label: "Comercial", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { value: "financeiro", label: "Financeiro", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "operacional", label: "Operacional", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "pessoas", label: "Pessoas", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  { value: "estrategico", label: "Estratégico", color: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
];

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Form = {
  id?: string;
  mes_ano: string;
  pilar: string;
  especifico: string;
  mensuravel: string;
  meta_valor: string;
  meta_unidade: string;
  atingivel: string;
  relevante: string;
  prazo: string;
  progresso: number;
  status: string;
  rc_user_id: string;
  observacoes: string;
};

const empty = (): Form => ({
  mes_ano: currentMonth(),
  pilar: "comercial",
  especifico: "",
  mensuravel: "",
  meta_valor: "",
  meta_unidade: "R$",
  atingivel: "",
  relevante: "",
  prazo: "",
  progresso: 0,
  status: "ativo",
  rc_user_id: "_none",
  observacoes: "",
});

   export default function PlanejamentoGerencial() {
     const { user } = useAuth();
     const { orgId } = useOrg();
     const { isGestor, gestorCode, loading: roleLoading } = useRole();
  const [items, setItems] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty());
  const [filtroMeses, setFiltroMeses] = useState<string[]>([]); // [] = Todos
  const [filtroPilar, setFiltroPilar] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativo");
  const [vendasAgg, setVendasAgg] = useState<{ mes_ano: string; faturamento_realizado: number | null; volume_kg: number | null; mb_cb_total: number | null; ml_cb_total: number | null }[]>([]);
  const [mesesVendasAll, setMesesVendasAll] = useState<string[]>([]);
  const [loadingVendas, setLoadingVendas] = useState(false);
  // Período para o painel de realizado.
  // atual = mês corrente, ano = ano todo, tri = trimestre atual, sem = semestre atual,
  // u3/u6/u12 = últimos 3/6/12 meses, multi = seleção manual
  type PeriodoModo = "atual" | "ano" | "tri" | "sem" | "u3" | "u6" | "u12" | "multi";
  const [periodoModo, setPeriodoModo] = useState<PeriodoModo>("atual");
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([currentMonth()]);

  const load = async () => {
    if (!orgId) return;
    
    let q = supabase
      .from("planejamento_gerencial")
      .select("*")
      .eq("organizacao_id", orgId);
    
    if (isGestor && gestorCode) {
      q = q.eq("cod_gestor", gestorCode);
    }

    const { data } = await q
      .order("mes_ano", { ascending: false })
      .order("created_at", { ascending: false });
    
    setItems(data ?? []);
    
    let rq = supabase
      .from("representantes")
      .select("auth_user_id, nome")
      .eq("organizacao_id", orgId)
      .not("auth_user_id", "is", null);
      
    if (isGestor && gestorCode) {
      rq = rq.eq("cod_gestor", gestorCode);
    }

    const { data: r } = await rq;
    setReps(r ?? []);

    // Carrega apenas a lista de meses disponíveis (usado pelo seletor multi)
    const { data: mesesData, error: mesesError } = await supabase
      .from("vendas")
      .select("mes_ano")
      .eq("organizacao_id", orgId)
      .not("mes_ano", "is", null)
      .order("data_nf", { ascending: false })
      .limit(20000);

    if (mesesError) {
      console.error("Erro ao carregar meses de vendas:", mesesError);
    }

    const meses = Array.from(
      new Set((mesesData ?? []).map((x: any) => x.mes_ano).filter(Boolean) as string[])
    ).sort().reverse();
    setMesesVendasAll(meses);
  };

  const carregarVendasDoPeriodo = async (meses: string[]) => {
    if (!orgId || meses.length === 0) {
      setVendasAgg([]);
      return;
    }
    setLoadingVendas(true);
    try {
      const data = await crmService.getVendas(orgId, meses, null, gestorCode);
      setVendasAgg(data as any[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVendas(false);
    }
  };

  useEffect(() => { load(); }, [orgId]);

  const filtroMesesSet = useMemo(() => new Set(filtroMeses), [filtroMeses]);
  const filtered = useMemo(() => {
    return items.filter((i) =>
      (filtroMesesSet.size === 0 || filtroMesesSet.has(i.mes_ano)) &&
      (filtroPilar === "todos" || i.pilar === filtroPilar) &&
      (filtroStatus === "todos" || i.status === filtroStatus)
    );
  }, [items, filtroMesesSet, filtroPilar, filtroStatus]);

  const mesesDisponiveis = useMemo(
    () => Array.from(new Set(items.map((i) => i.mes_ano))).sort().reverse(),
    [items]
  );

  // Lista de meses_ano disponíveis nas vendas (para o seletor multi)
  const mesesVendas = useMemo(
    () => mesesVendasAll,
    [mesesVendasAll]
  );

  // Helpers de período
  const fmtMes = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const ultimosNMeses = (n: number) => {
    const hoje = new Date();
    const arr: string[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      arr.push(fmtMes(d.getFullYear(), d.getMonth() + 1));
    }
    return arr;
  };

  // Resolve quais meses entram no período conforme o modo
  const mesesPeriodo = useMemo(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1; // 1-12
    if (periodoModo === "atual") return [currentMonth()];
    if (periodoModo === "ano") {
      return mesesVendas.filter((m) => m.startsWith(String(ano)));
    }
    if (periodoModo === "tri") {
      const triIdx = Math.floor((mes - 1) / 3); // 0..3
      const inicio = triIdx * 3 + 1;
      return [0, 1, 2].map((k) => fmtMes(ano, inicio + k));
    }
    if (periodoModo === "sem") {
      const inicio = mes <= 6 ? 1 : 7;
      return Array.from({ length: 6 }, (_, k) => fmtMes(ano, inicio + k));
    }
    if (periodoModo === "u3") return ultimosNMeses(3);
    if (periodoModo === "u6") return ultimosNMeses(6);
    if (periodoModo === "u12") return ultimosNMeses(12);
    return mesesSelecionados;
  }, [periodoModo, mesesSelecionados, mesesVendas]);

  // Escuta evento global de atualização de importações (inclusive entre abas do navegador)
  useEffect(() => {
    const handleRefresh = async () => {
      console.log("Evento de atualização recebido. Recarregando...");
      await load();
      // Pequeno delay para garantir consistência e dar tempo do estado mesesVendasAll propagar se necessário
      setTimeout(() => {
        carregarVendasDoPeriodo(mesesPeriodo);
      }, 500);
    };

    const channel = new BroadcastChannel("importacoes_refresh");
    channel.onmessage = (event) => {
      if (event.data === "refresh") handleRefresh();
    };

    window.addEventListener("importacoes:refresh-all", handleRefresh);
    
    return () => {
      channel.close();
      window.removeEventListener("importacoes:refresh-all", handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mesesPeriodo.join("|")]);

  // Recarrega vendas sempre que o período resolvido mudar
  useEffect(() => {
    carregarVendasDoPeriodo(mesesPeriodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mesesPeriodo.join("|")]);

  // Rótulo amigável do trimestre/semestre atual
  const periodoLabel = useMemo(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    if (periodoModo === "tri") return `T${Math.floor((mes - 1) / 3) + 1}/${ano}`;
    if (periodoModo === "sem") return `S${mes <= 6 ? 1 : 2}/${ano}`;
    return null;
  }, [periodoModo]);

  // Soma do realizado no período + quebra por mês
  const realizadoPeriodo = useMemo(() => {
    const set = new Set(mesesPeriodo);
    const filt = vendasAgg.filter((v) => v.mes_ano && set.has(v.mes_ano));
    const fat = filt.reduce((s, v) => s + (Number(v.faturamento_realizado) || 0), 0);
    const vol = filt.reduce((s, v) => s + (Number(v.volume_kg) || 0), 0);
    const mb = filt.reduce((s, v) => s + (Number(v.mb_cb_total) || 0), 0);
    const ml = filt.reduce((s, v) => s + (Number(v.ml_cb_total) || 0), 0);
    const porMes = new Map<string, { fat: number; vol: number; mb: number; ml: number }>();
    for (const m of mesesPeriodo) porMes.set(m, { fat: 0, vol: 0, mb: 0, ml: 0 });
    for (const v of filt) {
      const k = v.mes_ano!;
      const acc = porMes.get(k) ?? { fat: 0, vol: 0, mb: 0, ml: 0 };
      acc.fat += Number(v.faturamento_realizado) || 0;
      acc.vol += Number(v.volume_kg) || 0;
      acc.mb += Number(v.mb_cb_total) || 0;
      acc.ml += Number(v.ml_cb_total) || 0;
      porMes.set(k, acc);
    }
    const detalhe = Array.from(porMes.entries())
      .map(([mes_ano, x]) => ({ mes_ano, ...x }))
      .sort((a, b) => a.mes_ano.localeCompare(b.mes_ano));
    return { fat, vol, mb, ml, count: filt.length, detalhe };
  }, [vendasAgg, mesesPeriodo]);

  // Rótulo do modo de período (para exportação)
  const periodoModoLabel = useMemo(() => {
    const map: Record<string, string> = {
      atual: "Mês atual",
      ano: `Ano ${new Date().getFullYear()}`,
      tri: "Trimestre atual",
      sem: "Semestre atual",
      u3: "Últimos 3 meses",
      u6: "Últimos 6 meses",
      u12: "Últimos 12 meses",
      multi: "Meses selecionados",
    };
    return map[periodoModo] ?? periodoModo;
  }, [periodoModo]);

  // ===== Exportações =====
  const exportarCSV = () => {
    const sep = ";";
    const linhas: string[] = [];
    linhas.push(`Realizado no período${sep}${periodoModoLabel}${periodoLabel ? ` (${periodoLabel})` : ""}`);
    linhas.push(`Meses${sep}${mesesPeriodo.join(", ")}`);
    linhas.push("");
    linhas.push(["Mês", "Faturamento (R$)", "Volume (kg)", "Margem Bruta (R$)", "Margem Líquida (R$)", "MB %", "ML %"].join(sep));
    const fmt = (n: number) => n.toFixed(2).replace(".", ",");
    for (const d of realizadoPeriodo.detalhe) {
      const mbPct = d.fat > 0 ? (d.mb / d.fat) * 100 : 0;
      const mlPct = d.fat > 0 ? (d.ml / d.fat) * 100 : 0;
      linhas.push([d.mes_ano, fmt(d.fat), fmt(d.vol), fmt(d.mb), fmt(d.ml), fmt(mbPct), fmt(mlPct)].join(sep));
    }
    const mbPctT = realizadoPeriodo.fat > 0 ? (realizadoPeriodo.mb / realizadoPeriodo.fat) * 100 : 0;
    const mlPctT = realizadoPeriodo.fat > 0 ? (realizadoPeriodo.ml / realizadoPeriodo.fat) * 100 : 0;
    linhas.push(["TOTAL", fmt(realizadoPeriodo.fat), fmt(realizadoPeriodo.vol), fmt(realizadoPeriodo.mb), fmt(realizadoPeriodo.ml), fmt(mbPctT), fmt(mlPctT)].join(sep));
    const csv = "\uFEFF" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realizado_${periodoModo}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const exportarPDF = () => {
    const fmtBRLp = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    const fmtNumP = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
    const mbPctT = realizadoPeriodo.fat > 0 ? (realizadoPeriodo.mb / realizadoPeriodo.fat) * 100 : 0;
    const mlPctT = realizadoPeriodo.fat > 0 ? (realizadoPeriodo.ml / realizadoPeriodo.fat) * 100 : 0;
    const linhasHtml = realizadoPeriodo.detalhe.map((d) => {
      const mbPct = d.fat > 0 ? (d.mb / d.fat) * 100 : 0;
      const mlPct = d.fat > 0 ? (d.ml / d.fat) * 100 : 0;
      return `<tr>
        <td>${d.mes_ano}</td>
        <td class="r">${fmtBRLp(d.fat)}</td>
        <td class="r">${fmtNumP(d.vol)} kg</td>
        <td class="r">${fmtBRLp(d.mb)}</td>
        <td class="r">${fmtPct(mbPct)}</td>
        <td class="r">${fmtBRLp(d.ml)}</td>
        <td class="r">${fmtPct(mlPct)}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>Realizado no período</title>
    <style>
      *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:24px;margin:0}
      h1{font-size:18px;margin:0 0 4px} .sub{color:#64748b;font-size:12px;margin-bottom:16px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 18px}
      .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px}
      .kpi .l{font-size:10px;text-transform:uppercase;color:#64748b}
      .kpi .v{font-size:16px;font-weight:700;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f1f5f9;font-weight:600}
      td.r,th.r{text-align:right}
      tfoot td{font-weight:700;background:#f8fafc}
      .footer{margin-top:18px;font-size:10px;color:#94a3b8}
      @media print{ body{padding:12px} }
    </style></head><body>
    <h1>Realizado no período</h1>
    <div class="sub">${periodoModoLabel}${periodoLabel ? ` — ${periodoLabel}` : ""} · Meses: ${mesesPeriodo.join(", ") || "—"}</div>
    <div class="kpis">
      <div class="kpi"><div class="l">Faturamento</div><div class="v">${fmtBRLp(realizadoPeriodo.fat)}</div></div>
      <div class="kpi"><div class="l">Volume</div><div class="v">${fmtNumP(realizadoPeriodo.vol)} kg</div></div>
      <div class="kpi"><div class="l">Margem Bruta</div><div class="v">${fmtBRLp(realizadoPeriodo.mb)} <span style="font-size:11px;color:#64748b">(${fmtPct(mbPctT)})</span></div></div>
      <div class="kpi"><div class="l">Margem Líquida</div><div class="v">${fmtBRLp(realizadoPeriodo.ml)} <span style="font-size:11px;color:#64748b">(${fmtPct(mlPctT)})</span></div></div>
    </div>
    <table>
      <thead><tr>
        <th>Mês</th><th class="r">Faturamento</th><th class="r">Volume</th>
        <th class="r">MB</th><th class="r">MB %</th><th class="r">ML</th><th class="r">ML %</th>
      </tr></thead>
      <tbody>${linhasHtml || `<tr><td colspan="7" style="text-align:center;color:#94a3b8">Sem dados no período</td></tr>`}</tbody>
      <tfoot><tr>
        <td>TOTAL</td>
        <td class="r">${fmtBRLp(realizadoPeriodo.fat)}</td>
        <td class="r">${fmtNumP(realizadoPeriodo.vol)} kg</td>
        <td class="r">${fmtBRLp(realizadoPeriodo.mb)}</td>
        <td class="r">${fmtPct(mbPctT)}</td>
        <td class="r">${fmtBRLp(realizadoPeriodo.ml)}</td>
        <td class="r">${fmtPct(mlPctT)}</td>
      </tr></tfoot>
    </table>
    <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para exportar PDF"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  // Agregação de objetivos no período
  const objetivosPeriodo = useMemo(() => {
    const set = new Set(mesesPeriodo);
    const filt = items.filter((i) => set.has(i.mes_ano));
    const ativos = filt.filter((i) => i.status === "ativo");
    const concluidos = filt.filter((i) => i.status === "concluido");
    const progressoMedio = ativos.length
      ? Math.round(ativos.reduce((s, i) => s + (Number(i.progresso) || 0), 0) / ativos.length)
      : 0;
    const metaTotal = filt.reduce((s, i) => s + (Number(i.meta_valor) || 0), 0);
    return { total: filt.length, ativos: ativos.length, concluidos: concluidos.length, progressoMedio, metaTotal };
  }, [items, mesesPeriodo]);

  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  const toggleMes = (m: string) => {
    setMesesSelecionados((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const kpis = useMemo(() => {
    const ativos = items.filter((i) => i.status === "ativo");
    const concluidos = items.filter((i) => i.status === "concluido");
    const progressoMedio = ativos.length
      ? Math.round(ativos.reduce((s, i) => s + (Number(i.progresso) || 0), 0) / ativos.length)
      : 0;
    return { total: items.length, ativos: ativos.length, concluidos: concluidos.length, progressoMedio };
  }, [items]);

  const salvar = async () => {
    if (!user || !orgId) return;
    if (!form.especifico.trim()) return toast.error("Descreva o objetivo (Específico)");
    const rcId = form.rc_user_id && form.rc_user_id !== "_none" ? form.rc_user_id : null;
    const rcNome = rcId ? reps.find((r) => r.auth_user_id === rcId)?.nome ?? null : null;
    const payload: any = {
      organizacao_id: orgId,
      gestor_id: user.id,
      mes_ano: form.mes_ano,
      pilar: form.pilar,
      especifico: form.especifico.trim(),
      mensuravel: form.mensuravel.trim() || null,
      meta_valor: form.meta_valor ? Number(form.meta_valor) : null,
      meta_unidade: form.meta_unidade || null,
      atingivel: form.atingivel.trim() || null,
      relevante: form.relevante.trim() || null,
      prazo: form.prazo || null,
      progresso: Number(form.progresso) || 0,
      status: form.status,
      rc_user_id: rcId,
      rc_nome: rcNome,
      observacoes: form.observacoes.trim() || null,
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("planejamento_gerencial").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("planejamento_gerencial").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Atualizado" : "Objetivo gerencial criado");
    setOpen(false);
    setForm(empty());
    load();
  };

  const editar = (it: any) => {
    setForm({
      id: it.id,
      mes_ano: it.mes_ano,
      pilar: it.pilar ?? "comercial",
      especifico: it.especifico ?? "",
      mensuravel: it.mensuravel ?? "",
      meta_valor: it.meta_valor != null ? String(it.meta_valor) : "",
      meta_unidade: it.meta_unidade ?? "R$",
      atingivel: it.atingivel ?? "",
      relevante: it.relevante ?? "",
      prazo: it.prazo ?? "",
      progresso: it.progresso ?? 0,
      status: it.status ?? "ativo",
      rc_user_id: it.rc_user_id ?? "_none",
      observacoes: it.observacoes ?? "",
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este objetivo gerencial?")) return;
    const { error } = await supabase.from("planejamento_gerencial").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  const atualizarProgresso = async (id: string, p: number) => {
    const { error } = await supabase
      .from("planejamento_gerencial")
      .update({ progresso: p, status: p >= 100 ? "concluido" : "ativo" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

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
        <PageHeader title="Planejamento Gerencial" subtitle="Acesso restrito ao gestor" />
        <Card className="p-6 text-sm text-muted-foreground">
          Esta área é restrita ao gestor da organização.
        </Card>
      </>
    );
  }

  const pilarMeta = (p: string) => PILARES.find((x) => x.value === p) ?? PILARES[0];

  return (
    <>
      <Seo title="Planejamento Gerencial" description="Defina objetivos SMART por pilar (comercial, financeiro, pessoas) e acompanhe o realizado em diferentes períodos." path="/planejamento-gerencial" />
      <PageHeader
        title="Planejamento Gerencial"
        subtitle="Objetivos SMART da organização e da equipe"
        actions={
          <Button onClick={() => { setForm(empty()); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Novo objetivo
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
              Diretriz de Planejamento: Foco em Resultados SMART
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              O planejamento gerencial deve ser revisado semanalmente para garantir agilidade. 
              Ao criar metas para os 5 pilares, busque indicadores <strong>Mensuráveis</strong> (Faturamento, Volume ou Margem) e defina prazos claros. 
              O acompanhamento em tempo real do <strong>Realizado no Período</strong> abaixo permite ajustar as velas antes do fechamento do mês.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-primary uppercase tracking-wider pt-1">
              <span className="flex items-center gap-1">● Comercial: Mix de Produtos</span>
              <span className="flex items-center gap-1">● Financeiro: Fluxo e Inadimplência</span>
              <span className="flex items-center gap-1">● Pessoas: Treinamento e Retenção</span>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-5">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-primary">{kpis.ativos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-bold text-emerald-600">{kpis.concluidos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Progresso médio (ativos)</p>
          <p className="text-2xl font-bold">{kpis.progressoMedio}%</p>
        </Card>
      </section>

      {/* ===== PAINEL: REALIZADO + OBJETIVOS POR PERÍODO ===== */}
      <Card className="p-4 mb-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Realizado no período</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={periodoModo} onValueChange={(v) => setPeriodoModo(v as any)}>
              <SelectTrigger className="w-[210px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atual">Mês atual</SelectItem>
                <SelectItem value="tri">Trimestre atual</SelectItem>
                <SelectItem value="sem">Semestre atual</SelectItem>
                <SelectItem value="ano">Ano todo ({new Date().getFullYear()})</SelectItem>
                <SelectItem value="u3">Últimos 3 meses</SelectItem>
                <SelectItem value="u6">Últimos 6 meses</SelectItem>
                <SelectItem value="u12">Últimos 12 meses</SelectItem>
                <SelectItem value="multi">Selecionar meses…</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" onClick={exportarCSV} disabled={mesesPeriodo.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />CSV
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={exportarPDF} disabled={mesesPeriodo.length === 0}>
              <FileText className="h-3.5 w-3.5 mr-1" />PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => { load(); carregarVendasDoPeriodo(mesesPeriodo); }}
              disabled={loadingVendas}
              title="Recarregar dados"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingVendas ? "animate-spin" : ""}`} />
              {loadingVendas ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        </div>

        {periodoModo === "multi" && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {mesesVendas.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem vendas importadas ainda.</p>
            )}
            {mesesVendas.map((m) => {
              const ativo = mesesSelecionados.includes(m);
              return (
                <Button
                  key={m}
                  size="sm"
                  variant={ativo ? "default" : "outline"}
                  className="h-7 text-[11px]"
                  onClick={() => toggleMes(m)}
                >
                  {m}
                </Button>
              );
            })}
            {mesesSelecionados.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setMesesSelecionados([])}>
                Limpar
              </Button>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          {periodoLabel && <span className="mr-1 font-semibold text-foreground">{periodoLabel} —</span>}
          Período considerado: <b>{mesesPeriodo.length === 0 ? "—" : mesesPeriodo.join(", ")}</b>
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Realizado */}
          <div className="rounded-xl border p-4 space-y-2 bg-gradient-to-br from-primary/5 to-transparent">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Faturamento realizado
            </p>
            <p className="text-3xl font-bold text-primary">{fmtBRL(realizadoPeriodo.fat)}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
              <div>
                <p className="text-[10px] uppercase">Volume</p>
                <p className="font-semibold text-foreground">{fmtNum(realizadoPeriodo.vol)} kg</p>
              </div>
              <div>
                <p className="text-[10px] uppercase">Margem bruta</p>
                <p className="font-semibold text-foreground">{fmtBRL(realizadoPeriodo.mb)}</p>
              </div>
            </div>
          </div>

          {/* Objetivos do período */}
          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Objetivos no período
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Ativos</p>
                <p className="text-xl font-bold text-primary">{objetivosPeriodo.ativos}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Concluídos</p>
                <p className="text-xl font-bold text-emerald-600">{objetivosPeriodo.concluidos}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Progresso médio</p>
                <p className="text-xl font-bold">{objetivosPeriodo.progressoMedio}%</p>
              </div>
            </div>
            {objetivosPeriodo.metaTotal > 0 && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Soma das metas numéricas: <b className="text-foreground">{fmtBRL(objetivosPeriodo.metaTotal)}</b>
              </p>
            )}
            {objetivosPeriodo.total === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhum objetivo cadastrado nesse período.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card className="p-3 mb-4 flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <MesMultiSelect
          available={mesesDisponiveis}
          value={filtroMeses}
          onChange={setFiltroMeses}
          allowEmpty
          label=""
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs">Pilar</Label>
          <Select value={filtroPilar} onValueChange={setFiltroPilar}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {PILARES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista */}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum objetivo encontrado.<br />
            <span className="text-[11px]">
              Crie objetivos <b>Específicos, Mensuráveis, Atingíveis, Relevantes</b> e com prazo.
            </span>
          </Card>
        )}

        {filtered.map((it) => {
          const meta = pilarMeta(it.pilar);
          return (
            <Card key={it.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className="text-[10px]">{it.mes_ano}</Badge>
                    <Badge className={`text-[10px] ${meta.color} border-0`}>{meta.label}</Badge>
                    {it.status === "concluido" && <Badge className="text-[10px] bg-emerald-600 text-white">Concluído</Badge>}
                    {it.status === "cancelado" && <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>}
                    {it.rc_nome && <Badge variant="secondary" className="text-[10px]">RC: {it.rc_nome}</Badge>}
                    {it.prazo && (
                      <Badge variant="secondary" className="text-[10px]">
                        até {new Date(it.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{it.especifico}</p>
                  {it.mensuravel && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📊 {it.mensuravel}
                      {it.meta_valor != null && ` — meta: ${Number(it.meta_valor).toLocaleString("pt-BR")} ${it.meta_unidade ?? ""}`}
                    </p>
                  )}
                  {it.atingivel && <p className="text-xs text-muted-foreground mt-0.5">✅ {it.atingivel}</p>}
                  {it.relevante && <p className="text-xs text-muted-foreground mt-0.5">⭐ {it.relevante}</p>}
                  {it.observacoes && <p className="text-xs text-muted-foreground mt-0.5 italic">📝 {it.observacoes}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editar(it)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(it.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Progresso</span>
                  <span className="text-[11px] font-semibold">{it.progresso ?? 0}%</span>
                </div>
                <Progress value={Number(it.progresso) || 0} className="h-2" />
                <div className="flex gap-1 pt-1">
                  {[0, 25, 50, 75, 100].map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={Number(it.progresso) === p ? "default" : "outline"}
                      className="flex-1 h-7 text-[11px]"
                      onClick={() => atualizarProgresso(it.id, p)}
                    >
                      {p === 100 ? <Check className="h-3 w-3" /> : `${p}%`}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {form.id ? "Editar" : "Novo"} objetivo gerencial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Mês (AAAA-MM)</Label>
                <Input value={form.mes_ano} onChange={(e) => setForm({ ...form, mes_ano: e.target.value })} placeholder="2026-01" />
              </div>
              <div>
                <Label className="text-xs">Pilar</Label>
                <Select value={form.pilar} onValueChange={(v) => setForm({ ...form, pilar: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PILARES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Vincular a um representante (opcional)</Label>
              <Select value={form.rc_user_id} onValueChange={(v) => setForm({ ...form, rc_user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Toda a equipe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Toda a equipe / organização</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r.auth_user_id} value={r.auth_user_id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs"><b>S</b>pecífico — o que exatamente?</Label>
              <Textarea
                rows={2}
                value={form.especifico}
                onChange={(e) => setForm({ ...form, especifico: e.target.value })}
                placeholder="Ex.: Aumentar faturamento da linha Premium em 15% no trimestre"
              />
            </div>

            <div>
              <Label className="text-xs"><b>M</b>ensurável — como vou medir?</Label>
              <Input
                value={form.mensuravel}
                onChange={(e) => setForm({ ...form, mensuravel: e.target.value })}
                placeholder="Ex.: Faturamento bruto da linha Premium no relatório mensal"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Meta numérica</Label>
                <Input
                  type="number"
                  value={form.meta_valor}
                  onChange={(e) => setForm({ ...form, meta_valor: e.target.value })}
                  placeholder="500000"
                />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.meta_unidade} onValueChange={(v) => setForm({ ...form, meta_unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R$">R$</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="clientes">clientes</SelectItem>
                    <SelectItem value="visitas">visitas</SelectItem>
                    <SelectItem value="pedidos">pedidos</SelectItem>
                    <SelectItem value="%">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs"><b>A</b>tingível — como?</Label>
                <Input
                  value={form.atingivel}
                  onChange={(e) => setForm({ ...form, atingivel: e.target.value })}
                  placeholder="Ex.: Treinamento + 2 prospecções/semana por RC"
                />
              </div>
              <div>
                <Label className="text-xs"><b>R</b>elevante — por que importa?</Label>
                <Input
                  value={form.relevante}
                  onChange={(e) => setForm({ ...form, relevante: e.target.value })}
                  placeholder="Ex.: Aumenta margem e reduz dependência de commodities"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Progresso atual: {form.progresso}%</Label>
              <Input
                type="range" min={0} max={100} step={5}
                value={form.progresso}
                onChange={(e) => setForm({ ...form, progresso: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Notas, riscos, dependências…"
              />
            </div>

            <Button onClick={salvar} className="w-full">
              <Check className="mr-2 h-4 w-4" />Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
