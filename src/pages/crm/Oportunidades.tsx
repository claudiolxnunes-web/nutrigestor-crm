import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, TrendingUp, CheckCircle2, AlertTriangle, Target, GripVertical, Building2, Users, Sparkles, Info, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Seo } from "@/components/Seo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtMoneyAbbr } from "@/utils/crm/formatters";
 import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {

  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useOportunidades, Etapa, MOTIVOS_PERDA } from "@/hooks/crm/useOportunidades";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const ETAPAS: { id: Etapa; label: string; bg: string; ring: string; head: string }[] = [
  { id: "prospeccao",   label: "Prospecção",   bg: "bg-slate-50 dark:bg-slate-900/40",   ring: "border-slate-300",  head: "bg-slate-600 text-white" },
  { id: "qualificacao", label: "Qualificação", bg: "bg-sky-50 dark:bg-sky-950/30",       ring: "border-sky-300",    head: "bg-sky-600 text-white" },
  { id: "proposta",     label: "Proposta",     bg: "bg-amber-50 dark:bg-amber-950/30",   ring: "border-amber-300",  head: "bg-amber-500 text-white" },
  { id: "ganho",        label: "Ganho",        bg: "bg-emerald-50 dark:bg-emerald-950/30", ring: "border-emerald-300", head: "bg-emerald-600 text-white" },
  { id: "perdido",      label: "Perdido",      bg: "bg-red-50 dark:bg-red-950/30",       ring: "border-red-200",    head: "bg-red-500 text-white" },
];

export default function Oportunidades() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const { orgId } = useOrg();
  const { isGestor } = useRole();
  
  const {
    items,
    loading,
    busca,
    setBusca,
    filtroRc,
    setFiltroRc,
    reps,
    filtrados,
    moveEtapa
  } = useOportunidades(orgId, user?.id, isGestor);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [perdidoDialog, setPerdidoDialog] = useState<{ id: string } | null>(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [concorrente, setConcorrente] = useState("");
  const [motivoOutro, setMotivoOutro] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const totais = useMemo(() => {
    const t = { ativo: 0, ganho: 0, paradas: 0, totalAtivo: 0, totalGanho: 0 };
    const agora = Date.now();
    filtrados.forEach((it) => {
      const v = Number(it.valor) || 0;
      if (it.etapa_pipeline === "ganho") { t.ganho++; t.totalGanho += v; }
      else if (it.etapa_pipeline !== "perdido") { t.ativo++; t.totalAtivo += v; }
      const ref = new Date(it.etapa_atualizada_em ?? it.updated_at ?? it.created_at).getTime();
      const dias = (agora - ref) / 86400000;
      if (dias > 14 && it.etapa_pipeline !== "ganho" && it.etapa_pipeline !== "perdido") t.paradas++;
    });
    const taxa = (t.ganho + t.ativo) > 0 ? Math.round((t.ganho / (t.ganho + t.ativo)) * 100) : 0;
    return { ...t, taxa };
  }, [filtrados]);

  const porEtapa = (etapa: Etapa) => filtrados.filter((i) => i.etapa_pipeline === etapa);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const novaEtapa = overId as Etapa;
    const item = items.find(x => x.id === id);
    
    if (!item || item.etapa_pipeline === novaEtapa) return;

    if (novaEtapa === "perdido") {
      setPerdidoDialog({ id });
      return;
    }
    
    try {
      const success = await moveEtapa(id, novaEtapa);
      if (success) {
        toast.success(`Movido para ${ETAPAS.find(x => x.id === novaEtapa)?.label}`);
      }
    } catch (error) {
      console.error("Erro ao mover oportunidade:", error);
      toast.error("Erro ao atualizar etapa no banco de dados.");
    }
  };

  const confirmarPerda = async () => {
    if (!perdidoDialog) return;
    if (!motivoPerda) {
      toast.error("Selecione o motivo da perda");
      return;
    }
    const success = await moveEtapa(perdidoDialog.id, "perdido", {
      motivoPerda,
      motivoOutro,
      concorrente
    });
    if (success) {
      toast.success("Oportunidade marcada como perdida");
      setPerdidoDialog(null);
      setMotivoPerda("");
      setConcorrente("");
      setMotivoOutro("");
    }
  };

  const activeItem = items.find((x) => x.id === activeId);

  return (
     <div className="space-y-6 pb-20">
       <Seo title="Pipeline de Oportunidades" description="Gestão visual do funil de vendas Agro_RC" path="/oportunidades" />
       <PageHeader 
         title="Oportunidades" 
         subtitle="Pipeline comercial inteligente — arraste para evoluir" 
         actions={
           <Button onClick={() => navigate("/integracoes-ia")} variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
             <Plus className="w-4 h-4" />
             Novo via Agente IA
           </Button>
         }
       />


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">{fmtMoneyAbbr(totais.totalAtivo)}</p>
            <p className="text-xs text-muted-foreground">Pipeline Ativo</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">{fmtMoneyAbbr(totais.totalGanho)}</p>
            <p className="text-xs text-muted-foreground">Total Ganho</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
            <Target className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">{totais.taxa}%</p>
            <p className="text-xs text-muted-foreground">Taxa Conversão</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3 border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">{totais.paradas}</p>
            <p className="text-xs text-muted-foreground">Paradas (+14d)</p>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar oportunidade..." className="pl-9" />
        </div>
        {isGestor && reps.length > 0 && (
          <Select value={filtroRc} onValueChange={setFiltroRc}>
            <SelectTrigger className="md:w-64"><SelectValue placeholder="Representante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os representantes</SelectItem>
              {reps.filter(r => r.cod_rc).map((r) => (
                <SelectItem key={r.cod_rc!} value={r.cod_rc!}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-12">Carregando pipeline...</p>}

      {!loading && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
           <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible">
            {ETAPAS.map((etapa) => {
              const cards = porEtapa(etapa.id);
              const total = cards.reduce((s, c) => s + (Number(c.valor) || 0), 0);
              return (
                <Coluna key={etapa.id} etapa={etapa} count={cards.length} totalLabel={fmtMoneyAbbr(total)}>
                  {cards.map((c) => <CardOportunidade key={c.id} item={c} etapa={etapa} />)}
                  {cards.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-6 italic">Solte um card aqui</p>
                  )}
                </Coluna>
              );
            })}
          </div>

          <DragOverlay>
            {activeItem && (
              <div className="opacity-90 rotate-2">
                <CardConteudo item={activeItem} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog open={!!perdidoDialog} onOpenChange={(o) => !o && setPerdidoDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Por que a oportunidade foi perdida?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo principal</Label>
              <Select value={motivoPerda} onValueChange={setMotivoPerda}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_PERDA.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {motivoPerda === "concorrente" && (
              <div className="space-y-2">
                <Label>Qual concorrente?</Label>
                <Input value={concorrente} onChange={(e) => setConcorrente(e.target.value)} placeholder="Nome da empresa/marca..." />
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição / Detalhes</Label>
              <Textarea 
                value={motivoOutro} 
                onChange={(e) => setMotivoOutro(e.target.value)} 
                placeholder="Descreva o que aconteceu..."
                className="h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerdidoDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarPerda}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Coluna({ etapa, count, totalLabel, children }: { etapa: typeof ETAPAS[number]; count: number; totalLabel: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  return (
    <div ref={setNodeRef} className={cn(
      "rounded-[28px] border-2 transition-all duration-300 flex flex-col min-h-[500px]",
      etapa.ring,
      etapa.bg,
      isOver ? "scale-[1.02] ring-4 ring-primary/5 shadow-2xl" : "shadow-sm"
    )}>
      <div className={cn("px-5 py-4 rounded-t-[26px] flex items-center justify-between", etapa.head)}>
        <div className="space-y-0.5">
          <p className="text-xs font-black uppercase tracking-widest opacity-90">{etapa.label}</p>
          <p className="text-sm font-black tracking-tightest">{totalLabel}</p>
        </div>
        <div className="bg-white/20 backdrop-blur-md text-white h-7 px-2.5 rounded-full text-[10px] font-black flex items-center justify-center">
          {count}
        </div>
      </div>
      <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
}

function CardOportunidade({ item, etapa }: { item: any; etapa: typeof ETAPAS[number] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <CardConteudo item={item} />
    </div>
  );
}

function CardConteudo({ item }: { item: any }) {
  const ref = item.etapa_atualizada_em ?? item.updated_at ?? item.created_at;
  const dias = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) : 0;
  const parado = dias > 14 && item.etapa_pipeline !== "ganho" && item.etapa_pipeline !== "perdido";
  const valor = Number(item.valor) || 0;

  return (
    <motion.div
      layoutId={item.id}
      whileHover={{ y: -2, scale: 1.01 }}
      className="premium-card p-4 space-y-3 hover:shadow-xl transition-all cursor-grab active:cursor-grabbing border-slate-100/50 dark:border-white/5 relative group bg-white dark:bg-slate-900"
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-3.5 w-3.5 text-slate-300" />
      </div>
      
      <div className="space-y-1.5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-black text-slate-900 dark:text-white leading-tight line-clamp-2 uppercase tracking-tight">{item.titulo_oportunidade ?? item.cliente_nome}</p>
          {item.etapa_pipeline === "proposta" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-1 bg-amber-100 dark:bg-amber-900/40 rounded-md cursor-help animate-pulse">
                    <Sparkles className="h-3 w-3 text-amber-600" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] max-w-[150px]">
                  IA Sugere: Oferecer produto complementar baseado no histórico.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold text-slate-400 truncate flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> {item.cliente_nome}
          </p>
          {(item.rc_nome || item.cod_rc) && (
            <p className="text-[10px] font-bold text-slate-400 truncate flex items-center gap-1.5">
              <Users className="h-3 w-3" /> {item.rc_nome ?? item.cod_rc}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-white/5">
        <div className="flex flex-col">
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{fmtMoneyAbbr(valor)}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Budget Est.</span>
        </div>
        {item.probabilidade != null && (
          <div className="flex flex-col items-end">
            <span className="text-xs font-black text-slate-900 dark:text-white">{item.probabilidade}%</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Conversão</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.linha && (
          <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest px-2 py-0 bg-primary/5 text-primary border-transparent">
            {item.linha}
          </Badge>
        )}
        {parado && (
          <Badge variant="destructive" className="text-[8px] font-black uppercase tracking-widest px-2 py-0 bg-rose-50 text-rose-600 border-transparent">
            <AlertTriangle className="h-2 w-2 mr-1" /> {dias}d Parado
          </Badge>
        )}
        {item.probabilidade_churn > 70 && (
          <Badge variant="destructive" className="text-[8px] font-black uppercase tracking-widest px-2 py-0 bg-rose-50 text-rose-600 border-transparent">
             Risco Churn Alta
          </Badge>
        )}
        {item.probabilidade_churn > 70 && (
          <Badge variant="destructive" className="text-[8px] font-black uppercase tracking-widest px-2 py-0 bg-rose-50 text-rose-600 border-transparent">
             Risco Churn Alta
          </Badge>
        )}
      </div>

      <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-[0.1em] pt-1">
        {format(new Date(ref ?? Date.now()), "dd MMM yyyy", { locale: ptBR })}
      </p>
    </motion.div>
  );
}