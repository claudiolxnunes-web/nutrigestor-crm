import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, MapPin, Camera, Clock, CheckCircle2, AlertCircle, Search, Users, TrendingUp, Target, BadgeCheck, Trash2, Edit3, Image as ImageIcon, PieChart, BarChart3, ChevronRight, Package, Lightbulb, Mic } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isSameDay, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVisitas, type Visita } from "@/hooks/crm/useVisitas";
import { useRole } from "@/hooks/useRole";
import { useOrg } from "@/hooks/useOrg";
import { useMetas } from "@/hooks/crm/useMetas";
import { useCrmKpis } from "@/hooks/crm/useCrmKpis";
import { fmtBRL, fmtPct, fmtNum } from "@/utils/crm/formatters";
import { VisitaDialog } from "@/components/crm/visitas/VisitaDialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUS_META: Record<Visita["status"], { label: string; cls: string }> = {
  planejada: { label: "Planejada", cls: "bg-slate-100 text-slate-700" },
  em_andamento: { label: "Em andamento", cls: "bg-amber-100 text-amber-800" },
  realizada: { label: "Realizada", cls: "bg-emerald-100 text-emerald-800" },
  cancelada: { label: "Cancelada", cls: "bg-rose-100 text-rose-700" },
};

const CAT_LABEL: Record<string, string> = {
  prospeccao: "Prospecção", manutencao: "Manutenção", recuperacao: "Recuperação", retorno: "Retorno",
};

function KpiCard({ icon: Icon, label, value, hint, tone = "primary" }: any) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600",
  };
  return (
    <Card className="p-4 sm:p-5 relative overflow-hidden">
      <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br ${tones[tone]} blur-2xl opacity-70`} />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="text-3xl font-black mt-2 text-slate-900 dark:text-white">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </div>
    </Card>
  );
}

function VisitaRow({ v, onEdit, onDelete, mostrarRC }: { v: Visita; onEdit: () => void; onDelete: () => void; mostrarRC?: boolean }) {
  const meta = STATUS_META[v.status];
  return (
    <div className="group p-4 rounded-xl border bg-card hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-sm truncate">{v.cliente_nome}</p>
            <Badge className={`${meta.cls} text-[10px] border-0`}>{meta.label}</Badge>
            {v.categoria_spin && <Badge variant="outline" className="text-[10px]">{CAT_LABEL[v.categoria_spin] ?? v.categoria_spin}</Badge>}
            {v.gerou_pedido && <Badge className="bg-emerald-500/10 text-emerald-700 border-0 text-[10px]"><BadgeCheck className="h-3 w-3 mr-0.5" />Pedido</Badge>}
            {(v.spin_situacao || v.spin_problema) && <Badge className="bg-blue-500/10 text-blue-700 border-0 text-[10px]">SPIN</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(parseISO(v.data_visita), "dd/MM/yyyy", { locale: ptBR })}</span>
            {v.cidade && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{v.cidade}{v.uf ? ` / ${v.uf}` : ""}</span>}
            {v.duracao_minutos != null && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{v.duracao_minutos} min</span>}
            {mostrarRC && v.rc_nome && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{v.rc_nome}</span>}
            {v.foto_url && <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" />foto</span>}
          </div>
          {v.objetivo && <p className="text-xs mt-2 text-foreground/80 line-clamp-2"><span className="font-semibold">Objetivo:</span> {v.objetivo}</p>}
          {v.resultado && <p className="text-xs mt-1 text-foreground/80 line-clamp-2"><span className="font-semibold">Resultado:</span> {v.resultado}</p>}
          {v.proximo_passo && (
            <p className="text-xs mt-1 text-primary"><span className="font-semibold">Próximo passo:</span> {v.proximo_passo}{v.proxima_data ? ` — ${format(parseISO(v.proxima_data), "dd/MM")}` : ""}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Edit3 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function Visitas() {
   const { isGestor, isRC, loading: roleLoading } = useRole();
  const { orgId } = useOrg();
  const [tab, setTab] = useState<"agenda" | "historico" | "kpis" | "equipe">("agenda");
  const [equipeMode, setEquipeMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Visita | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [query, setQuery] = useState("");

  // Carregamento de metas e faturamento para o RC
  const { data: metasData, isLoading: loadingMetas } = useMetas(orgId);
  const currentMonthStr = format(new Date(), "yyyy-MM");
  
  const myKpis = useCrmKpis({
    vendas: (metasData?.vendasAgg ?? []).filter(v => v.mes_ano === currentMonthStr),
    metas: (metasData?.metas ?? []).filter(m => m.mes_ano === currentMonthStr),
    pedidosAberto: (metasData?.pedidosAberto ?? []).filter(p => {
      const ultimo = (metasData?.pedidosAberto ?? []).reduce((max, x) => (x.data_snapshot && x.data_snapshot > max ? x.data_snapshot : max), "");
      return p.data_snapshot === ultimo;
    }),
    mesCorrente: currentMonthStr
  });

  const inicio = startOfMonth(new Date());
  const fim = endOfMonth(new Date());

  const { list, remove } = useVisitas({
    equipeMode: equipeMode || tab === "equipe",
    from: format(inicio, "yyyy-MM-dd"),
    to: format(addDays(fim, 30), "yyyy-MM-dd"),
  });

  const visitas = list.data ?? [];

  const hoje = new Date();
  const proximas = useMemo(
    () => visitas.filter((v) => v.status === "planejada" || v.status === "em_andamento")
      .sort((a, b) => a.data_visita.localeCompare(b.data_visita))
      .slice(0, 12),
    [visitas]
  );
  const doDia = useMemo(() => visitas.filter((v) => isSameDay(parseISO(v.data_visita), hoje)), [visitas]);

  const kpis = useMemo(() => {
    const noMes = visitas.filter((v) => {
      const d = parseISO(v.data_visita);
      return d >= inicio && d <= fim;
    });
    const realizadas = noMes.filter((v) => v.status === "realizada");
    const planejadas = noMes.length;
    const taxa = planejadas ? Math.round((realizadas.length / planejadas) * 100) : 0;
    const comPedido = realizadas.filter((v) => v.gerou_pedido);
    const conversao = realizadas.length ? Math.round((comPedido.length / realizadas.length) * 100) : 0;
    
    const porCliente: Record<string, number> = {};
    const porStatus: Record<string, number> = {};
    
    noMes.forEach(v => {
      porStatus[v.status] = (porStatus[v.status] || 0) + 1;
      const name = v.cliente_nome;
      porCliente[name] = (porCliente[name] || 0) + 1;
    });

    const topClientes = Object.entries(porCliente)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const statusSummary = Object.entries(porStatus).map(([s, count]) => ({
      label: STATUS_META[s as keyof typeof STATUS_META]?.label || s,
      count,
      cls: STATUS_META[s as keyof typeof STATUS_META]?.cls || ""
    }));

    const clientesUnicos = new Set(realizadas.map((v) => v.cliente_id || v.cliente_nome)).size;
    return { 
      planejadas, 
      realizadas: realizadas.length, 
      taxa, 
      conversao, 
      clientesUnicos, 
      comPedido: comPedido.length,
      topClientes,
      statusSummary
    };
  }, [visitas]);

  const historicoFiltrado = useMemo(() => {
    return visitas.filter((v) => {
      if (filtroStatus !== "todos" && v.status !== filtroStatus) return false;
      if (query && !v.cliente_nome.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [visitas, filtroStatus, query]);

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta visita?")) return;
    await remove.mutateAsync(id);
    toast.success("Visita excluída");
  };

  return (
    <>
      <PageHeader
        title="Visitas"
        subtitle="Agenda, check-in em campo e relatórios de visita"
        actions={
          <div className="flex items-center gap-2">
            {isGestor && (
              <Button variant={equipeMode ? "default" : "outline"} size="sm" onClick={() => setEquipeMode(!equipeMode)}>
                <Users className="h-4 w-4 mr-1" />{equipeMode ? "Equipe" : "Minhas"}
              </Button>
            )}
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nova visita
            </Button>
          </div>
        }
      />

       {!roleLoading && isRC && (
        <Card className="p-4 border-amber-200 bg-amber-50/30 mb-6">
          <div className="flex gap-3">
            <div className="p-2 bg-amber-100 rounded-lg h-fit">
              <Lightbulb className="h-5 w-5 text-amber-600 shrink-0" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-900">Guia do Representante: Alta Performance</h4>
              <p className="text-xs text-amber-800/80 leading-relaxed mt-1">
                Para atingir seus objetivos de faturamento e margem, utilize o fluxo de trabalho recomendado:
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                <div className="flex items-center gap-2 text-[11px] text-amber-900/70">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold">1</span>
                  <span><strong>Planejamento:</strong> Organize seu roteiro por proximidade para reduzir tempo de deslocamento.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-amber-900/70">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold">2</span>
                  <span><strong>Técnica SPIN:</strong> Use os botões rápidos de Situação, Problema, Implicação e Necessidade.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-amber-900/70">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold">3</span>
                  <span><strong>Execução:</strong> Faça Check-in/Check-out em campo para garantir a precisão da auditoria.</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-amber-900/70">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold">4</span>
                  <span><strong>Foco em Metas:</strong> Monitore o card de faturamento acima e priorize clientes de maior MB%.</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

       {!roleLoading && isRC && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Alcance da Meta (Fat.)</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{fmtPct(myKpis.atingFat)}</span>
                <span className="text-xs text-muted-foreground">de {fmtBRL(myKpis.metaFat)}</span>
              </div>
              <div className="mt-3 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${Math.min(100, myKpis.atingFat * 100)}%` }}
                />
              </div>
              <Link to="/meu-painel" className="mt-3 flex items-center gap-1 text-[10px] font-bold text-primary hover:underline uppercase">
                Ver detalhes <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <Target className="absolute -bottom-2 -right-2 h-16 w-16 text-primary/10 group-hover:scale-110 transition-transform" />
          </Card>

          <Card className="p-4 relative overflow-hidden group">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Faturamento Realizado</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{fmtBRL(myKpis.fat)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {myKpis.aberto > 0 ? `+ ${fmtBRL(myKpis.aberto)} em aberto` : "Sem pedidos em aberto"}
            </p>
            <TrendingUp className="absolute -bottom-2 -right-2 h-16 w-16 text-slate-100 dark:text-slate-800 group-hover:scale-110 transition-transform" />
          </Card>

          <Card className="p-4 relative overflow-hidden group">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Volume Realizado</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{fmtNum(myKpis.vol)} <small className="text-xs font-normal">kg</small></span>
              {myKpis.metaVol > 0 && <span className="text-xs text-muted-foreground">/ {fmtNum(myKpis.metaVol)} kg</span>}
            </div>
            <div className="mt-3 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, (myKpis.metaVol > 0 ? myKpis.vol / myKpis.metaVol : 0) * 100)}%` }}
              />
            </div>
            <Package className="absolute -bottom-2 -right-2 h-16 w-16 text-slate-100 dark:text-slate-800 group-hover:scale-110 transition-transform" />
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={CalendarDays} label="Planejadas no mês" value={kpis.planejadas} tone="primary" />
        <KpiCard icon={CheckCircle2} label="Realizadas" value={kpis.realizadas} hint={`${kpis.taxa}% de execução`} tone="emerald" />
        <KpiCard icon={Target} label="Conv. em pedido" value={`${kpis.conversao}%`} hint={`${kpis.comPedido} pedidos`} tone="amber" />
        <KpiCard icon={Users} label="Clientes visitados" value={kpis.clientesUnicos} tone="primary" />
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="kpis">Performance</TabsTrigger>
          {isGestor && <TabsTrigger value="equipe">Equipe</TabsTrigger>}
        </TabsList>

        <TabsContent value="agenda" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Hoje · {format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}</h3>
              <Badge variant="outline">{doDia.length} visita{doDia.length !== 1 ? "s" : ""}</Badge>
            </div>
            {doDia.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nenhuma visita planejada para hoje. Cadastre uma nova ou planeje pela aba <span className="font-semibold">Meu Trabalho</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {doDia.map((v) => <VisitaRow key={v.id} v={v} mostrarRC={equipeMode || tab === "equipe"} onEdit={() => { setEditing(v); setDialogOpen(true); }} onDelete={() => onDelete(v.id)} />)}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">Próximas visitas</h3>
            {proximas.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">Nenhuma visita futura planejada.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {proximas.map((v) => <VisitaRow key={v.id} v={v} mostrarRC={equipeMode || tab === "equipe"} onEdit={() => { setEditing(v); setDialogOpen(true); }} onDelete={() => onDelete(v.id)} />)}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-3">
          <Card className="p-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="planejada">Planejada</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="realizada">Realizada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </Card>
          <div className="space-y-2">
            {historicoFiltrado.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma visita encontrada.</p>}
            {historicoFiltrado.map((v) => <VisitaRow key={v.id} v={v} mostrarRC={equipeMode || tab === "equipe"} onEdit={() => { setEditing(v); setDialogOpen(true); }} onDelete={() => onDelete(v.id)} />)}
          </div>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <PieChart className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Resumo por Status</h3>
              </div>
              
              <div className="space-y-4">
                {kpis.statusSummary.map((s) => (
                  <div key={s.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{s.label}</span>
                      <span className="font-bold">{s.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${s.cls.split(' ')[0] === 'bg-slate-100' ? 'bg-slate-400' : s.cls.split(' ')[0].replace('100', '500')}`} 
                        style={{ width: `${(s.count / kpis.planejadas) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Taxa de execução</p>
                  <p className="text-2xl font-black text-emerald-600">{kpis.taxa}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Conversão</p>
                  <p className="text-2xl font-black text-amber-600">{kpis.conversao}%</p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Clientes Mais Visitados</h3>
              </div>
              
              <div className="space-y-3">
                {kpis.topClientes.length === 0 ? (
                  <p className="text-center py-10 text-xs text-muted-foreground italic">Sem visitas registradas no período.</p>
                ) : (
                  kpis.topClientes.map(([nome, count]) => (
                    <div key={nome} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-transparent hover:border-primary/20 transition-all">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{nome}</p>
                        <p className="text-[10px] text-muted-foreground">Frequência mensal</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-primary">{count}</span>
                        <span className="text-[10px] text-muted-foreground">visita{count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card className="p-5">
             <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Tendências e Insights
             </h3>
             <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-[10px] font-bold text-primary uppercase">Média de Visitas/Dia</p>
                  <p className="text-xl font-black mt-1">{(kpis.realizadas / Math.max(1, new Date().getDate())).toFixed(1)}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">Pedidos Gerados</p>
                  <p className="text-xl font-black mt-1 text-emerald-700">{kpis.comPedido}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Visitas Canceladas</p>
                  <p className="text-xl font-black mt-1 text-slate-700">{kpis.statusSummary.find(s => s.label === 'Cancelada')?.count || 0}</p>
                </div>
             </div>
          </Card>
        </TabsContent>

        {isGestor && (
          <TabsContent value="equipe" className="space-y-3">
            <Card className="p-4 text-sm text-muted-foreground">
              Visualização consolidada das visitas de toda a equipe (modo auditoria).
            </Card>
            <div className="space-y-2">
              {visitas.map((v) => <VisitaRow key={v.id} v={v} mostrarRC onEdit={() => { setEditing(v); setDialogOpen(true); }} onDelete={() => onDelete(v.id)} />)}
              {visitas.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma visita registrada pela equipe ainda.</p>}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <VisitaDialog open={dialogOpen} onOpenChange={setDialogOpen} visita={editing} />
    </>
  );
}