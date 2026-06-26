import { useEffect, useMemo, useState, useRef } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ClipboardList, History, Plus, Phone, Truck, Target as TargetIcon, MapPin, Check, Trash2, X, Mail, FileText, Users, ClipboardEdit, Clock, BellRing, Home, MessageCircle, Send, ShoppingCart, FileSignature, User as UserIcon, LogOut, Mic, MicOff, Sparkles, Loader2, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AutocompleteCadastro, ItemSelecionado } from "@/components/crm/AutocompleteCadastro";
import { MeusClientesPicker } from "@/components/crm/MeusClientesPicker";
import { PlanejarMes } from "@/components/crm/planejar/PlanejarMes";
import { PlanejarSemana } from "@/components/crm/planejar/PlanejarSemana";
import { PlanejarDia } from "@/components/crm/planejar/PlanejarDia";
import { PlanejarSmart } from "@/components/crm/planejar/PlanejarSmart";
import { CicloTutorial } from "@/components/crm/planejar/CicloTutorial";
import { AlertasRC } from "@/components/crm/alertas/AlertasRC";
import { Seo } from "@/components/Seo";

type Tipo = "visita" | "ligacao" | "email" | "proposta" | "reuniao" | "pedido" | "tarefa";

const TIPO_LABEL: Record<Tipo, string> = {
  visita: "Visita",
  ligacao: "Ligação/WhatsApp",
  email: "E-mail",
  proposta: "Proposta",
  reuniao: "Reunião",
  pedido: "Pedido",
  tarefa: "Tarefa/Retorno",
};

const TIPO_ICON: Record<Tipo, any> = {
  visita: MapPin,
  ligacao: Phone,
  email: Mail,
  proposta: FileText,
  reuniao: Users,
  pedido: Truck,
  tarefa: TargetIcon,
};

type ResultadoVal = "positivo" | "neutro" | "negativo" | "followup";
const RESULTADOS: { value: ResultadoVal; label: string; cls: string; clsAtivo: string }[] = [
  { value: "positivo", label: "Positivo",  cls: "border-emerald-200 text-emerald-700 hover:bg-emerald-50", clsAtivo: "border-emerald-500 bg-emerald-500 text-white" },
  { value: "neutro",   label: "Neutro",    cls: "border-slate-200 text-slate-700 hover:bg-slate-50",       clsAtivo: "border-slate-500 bg-slate-500 text-white" },
  { value: "negativo", label: "Negativo",  cls: "border-red-200 text-red-700 hover:bg-red-50",             clsAtivo: "border-red-500 bg-red-500 text-white" },
  { value: "followup", label: "Follow-up", cls: "border-blue-200 text-blue-700 hover:bg-blue-50",          clsAtivo: "border-blue-500 bg-blue-500 text-white" },
];

const MOTIVOS_PERDA = [
  { value: "preco",         label: "Preço" },
  { value: "concorrencia",  label: "Concorrência" },
  { value: "prazo_entrega", label: "Prazo de entrega" },
  { value: "produto",       label: "Produto/qualidade" },
  { value: "credito",       label: "Crédito/financeiro" },
  { value: "sem_demanda",   label: "Sem demanda no momento" },
  { value: "outro",         label: "Outro" },
];

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Campo() {
  const { user } = useAuth();
  const [tab, setTab] = useState("hoje");

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Meu Trabalho" description="App de campo do representante: planejar visitas, registrar atividades, acompanhar plano semanal e alertas." path="/campo" />
      <HeaderRC user={user} />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsContent value="hoje" className="mt-0 p-4 space-y-4"><HojeTab userId={user?.id} onIrRegistrar={() => setTab("registrar")} /></TabsContent>
        <TabsContent value="planejar" className="mt-0 p-4 space-y-4"><PlanejarTab userId={user?.id} /></TabsContent>
        <TabsContent value="registrar" className="mt-0 p-4 space-y-4"><RegistrarTab userId={user?.id} /></TabsContent>
        <TabsContent value="historico" className="mt-0 p-4 space-y-4"><HistoricoTab userId={user?.id} /></TabsContent>
        <TabsContent value="alertas" className="mt-0 p-4 space-y-4"><AlertasRC /></TabsContent>

        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t">
          <TabsList className="grid grid-cols-5 w-full h-16 bg-transparent rounded-none p-0">
            <TabsTrigger value="hoje" className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-accent">
              <CalendarDays className="h-5 w-5" /><span className="text-[11px]">Hoje</span>
            </TabsTrigger>
            <TabsTrigger value="planejar" className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-accent">
              <ClipboardList className="h-5 w-5" /><span className="text-[11px]">Planejar</span>
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-accent">
              <BellRing className="h-5 w-5" /><span className="text-[11px]">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="registrar" className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-accent">
              <Plus className="h-5 w-5" /><span className="text-[11px]">Registrar</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex-col gap-1 h-full rounded-none data-[state=active]:bg-accent">
              <History className="h-5 w-5" /><span className="text-[11px]">Histórico</span>
            </TabsTrigger>
          </TabsList>
        </nav>
      </Tabs>
    </div>
  );
}

/* ---------------- HEADER RC ---------------- */
function HeaderRC({ user }: { user: any }) {
  const { orgId } = useOrg();
  const [nome, setNome] = useState<string>("");
  const [regiao, setRegiao] = useState<string>("");
  useEffect(() => {
    if (!user?.id || !orgId) return;
    supabase.from("representantes").select("nome, regiao")
      .eq("organizacao_id", orgId).eq("auth_user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setNome(data?.nome ?? user.email?.split("@")[0] ?? "Representante");
        setRegiao(data?.regiao ?? "");
      });
  }, [user?.id, orgId]);
  return (
    <header className="sticky top-0 z-20 bg-primary text-primary-foreground px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => window.location.href = "/"}
          className="p-1 -ml-1 rounded-md hover:bg-primary-foreground/10 transition-colors"
          title="Voltar ao Painel Desktop"
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black shrink-0 shadow-sm border border-white">
            <span className="text-primary text-sm tracking-tighter">AR</span>
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight truncate">{nome || "Representante"}</p>
          {regiao && <p className="text-xs opacity-90 truncate">{regiao}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] opacity-90 leading-none">Hoje</p>
          <p className="text-sm font-semibold leading-tight">{format(new Date(), "dd 'de' MMM.", { locale: ptBR })}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="ml-1 p-2 -mr-2 rounded-md hover:bg-primary-foreground/10" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

/* ---------------- HOJE ---------------- */
function HojeTab({ userId, onIrRegistrar }: { userId?: string; onIrRegistrar: () => void }) {
  const { orgId } = useOrg();
  const hoje = format(new Date(), "yyyy-MM-dd");
  const mesAtual = format(new Date(), "yyyy-MM");
  const [dia, setDia] = useState<any>(null);
  const [obs, setObs] = useState("");
  const [counts, setCounts] = useState({ visita: 0, ligacao: 0, proposta: 0, pedido: 0 });
  const [enviando, setEnviando] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [scoreData, setScoreData] = useState<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          }
        }
        if (finalText.trim()) {
          setObs(prev => (prev ? prev + " " : "") + finalText.trim());
        }
      };

      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = (event: any) => {
        console.error("Erro voz:", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return toast.error("Voz não suportada");
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      toast.info("Ouvindo relatório...");
    }
  };

  const loadDia = async () => {
    if (!userId) return;
    const { data } = await supabase.from("dias_trabalho").select("*")
      .eq("user_id", userId).eq("data", hoje).maybeSingle();
    setDia(data);
    setObs(data?.observacao ?? "");
  };

  const loadCounts = async () => {
    if (!userId) return;
    const inicio = `${hoje}T00:00:00`;
    const fim = `${hoje}T23:59:59`;
    const { data } = await supabase.from("interacoes").select("tipo")
      .eq("user_id", userId).gte("data", inicio).lte("data", fim);
    const c = { visita: 0, ligacao: 0, proposta: 0, pedido: 0 };
    (data ?? []).forEach((i: any) => {
      if (i.tipo === "visita") c.visita++;
      else if (i.tipo === "ligacao") c.ligacao++;
      else if (i.tipo === "proposta") c.proposta++;
      else if (i.tipo === "pedido") c.pedido++;
    });
    setCounts(c);
  };

  const loadScore = async () => {
    if (!userId || !orgId) return;
    
    const [vendasRes, metasRes, planosRes, interRes] = await Promise.all([
      supabase.from("vendas").select("faturamento_realizado").eq("organizacao_id", orgId).eq("user_id", userId).eq("mes_ano", mesAtual),
      supabase.from("metas").select("meta_faturamento").eq("organizacao_id", orgId).eq("user_id", userId).eq("mes_ano", mesAtual),
      supabase.from("planejamento_semanal").select("visitado").eq("user_id", userId).eq("semana_inicio", format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")),
      supabase.from("interacoes").select("tipo, status_pedido").eq("user_id", userId).gte("data", `${mesAtual}-01`).lte("data", `${mesAtual}-31T23:59:59`)
    ]);

    const fat = (vendasRes.data ?? []).reduce((s, v) => s + (Number(v.faturamento_realizado) || 0), 0);
    const meta = (metasRes.data ?? []).reduce((s, m) => s + (Number(m.meta_faturamento) || 0), 0);
    const plans = (planosRes.data ?? []);
    const planFeitos = plans.filter(p => p.visitado).length;
    const cumplimientoPct = plans.length > 0 ? planFeitos / plans.length : 0;
    const inters = (interRes.data ?? []);
    const atividadePct = Math.min(1, inters.length / 30);
    const orcs = inters.filter(i => i.tipo === 'proposta' || i.status_pedido === 'orcamento').length;
    const vends = inters.filter(i => i.status_pedido === 'vendido').length;
    const perds = inters.filter(i => i.status_pedido === 'perdido').length;
    const conversaoPct = (orcs + vends + perds) > 0 ? vends / (orcs + vends + perds) : 0;

    const atingPct = meta > 0 ? fat / meta : 0;
    const metaScore = meta > 0 ? Math.min(1.5, atingPct) : 0.5;
    const score = Math.round((metaScore * 40) + (cumplimientoPct * 25) + (atividadePct * 20) + (conversaoPct * 15));

    setScoreData({ score, atingPct });
  };

  useEffect(() => { loadDia(); loadCounts(); loadScore(); }, [userId]);

  const salvarObs = async () => {
    if (!userId || !orgId) return;
    const payload: any = {
      user_id: userId, organizacao_id: orgId, data: hoje,
      status: dia?.status ?? "campo", observacao: obs || null,
    };
    await supabase.from("dias_trabalho").upsert(payload, { onConflict: "user_id,data" });
    loadDia();
  };

  const enviarRelatorio = async () => {
    if (!userId || !orgId) return;
    setEnviando(true);
    const payload: any = {
      user_id: userId, organizacao_id: orgId, data: hoje,
      status: dia?.status ?? "campo", observacao: obs || null,
    };
    const { error } = await supabase.from("dias_trabalho").upsert(payload, { onConflict: "user_id,data" });
    setEnviando(false);
    if (error) return toast.error(error.message);
    const total = counts.visita + counts.ligacao + counts.proposta + counts.pedido;
    toast.success(`Relatório enviado! ${total} atividade(s) registrada(s) hoje.`);
    loadDia();
  };

  const cards = [
    { tipo: "visita",   label: "Visitas",   icon: Home,         count: counts.visita,   bg: "bg-blue-50 dark:bg-blue-950/30",     iconCls: "text-blue-600" },
    { tipo: "ligacao",  label: "Ligações",  icon: Phone,        count: counts.ligacao,  bg: "bg-pink-50 dark:bg-pink-950/30",     iconCls: "text-pink-600" },
    { tipo: "proposta", label: "Propostas", icon: FileSignature,count: counts.proposta, bg: "bg-amber-50 dark:bg-amber-950/30",   iconCls: "text-amber-600" },
    { tipo: "pedido",   label: "Pedidos",   icon: ShoppingCart, count: counts.pedido,   bg: "bg-emerald-50 dark:bg-emerald-950/30", iconCls: "text-emerald-600" },
  ];

  return (
    <>
      {scoreData && (
        <Card className="p-4 bg-primary text-white shadow-xl overflow-hidden relative border-none">
          <div className="absolute -right-4 -top-4 opacity-10">
            <TrendingUp className="h-24 w-24" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Meu Score Performance</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black">{scoreData.score}</span>
                <span className="text-xs font-bold opacity-60">pts</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Atingimento</p>
              <p className="text-sm font-black">{Math.round(scoreData.atingPct * 100)}%</p>
            </div>
          </div>
          <Progress value={scoreData.score} className="h-1.5 bg-white/20 mt-3" />
        </Card>
      )}

      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.tipo}
              onClick={onIrRegistrar}
              className={`${c.bg} rounded-xl p-3 flex flex-col items-center justify-center gap-1 border border-border/50 active:scale-95 transition-transform`}
            >
              <Icon className={`h-5 w-5 ${c.iconCls}`} />
              <span className="text-2xl font-bold leading-none">{c.count}</span>
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
            </button>
          );
        })}
      </div>

      <Button onClick={onIrRegistrar} size="lg" className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90">
        <Plus className="mr-2 h-5 w-5" /> Registrar Atividade
      </Button>

      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ClipboardEdit className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Observações Gerais do Dia</h3>
          </div>
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
              isListening 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-primary/10 text-primary hover:bg-primary/20 shadow-sm border border-primary/20"
            }`}
            title={isListening ? "Parar de ouvir" : "Gravar por voz"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">{isListening ? "Gravando..." : "Ditar"}</span>
          </button>
        </div>
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={salvarObs}
          rows={3}
          placeholder={isListening ? "Ouvindo relatório..." : "Situação do mercado, dificuldades encontradas..."}
          className={isListening ? "border-red-500 ring-1 ring-red-500" : ""}
        />
      </Card>

      <Button
        onClick={enviarRelatorio}
        disabled={enviando}
        size="lg"
        className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
      >
        <Send className="mr-2 h-5 w-5" />
        {enviando ? "Enviando..." : "Enviar Relatório do Dia"}
      </Button>
      <p className="text-center text-xs text-muted-foreground -mt-2">
        Ao enviar, o gerente regional verá seu relatório imediatamente.
      </p>

      <PlanoDoDia userId={userId} />
    </>
  );
}

function PlanoDoDia({ userId }: { userId?: string }) {
  const hoje = new Date();
  const semana = startOfWeek(hoje, { weekStartsOn: 1 });
  const diaIdx = (hoje.getDay() + 6) % 7; // 0=seg
  const [items, setItems] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState<string | null>(null);

  const load = async () => {
    if (!userId) return;
    const { data } = await supabase.from("planejamento_semanal").select("*")
      .eq("user_id", userId)
      .eq("semana_inicio", format(semana, "yyyy-MM-dd"))
      .eq("dia_semana", diaIdx)
      .order("ordem");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [userId]);

  const toggle = async (it: any) => {
    await supabase.from("planejamento_semanal").update({ visitado: !it.visitado }).eq("id", it.id);
    load();
  };

  const gerarBriefingOffline = async (it: any) => {
    setLoadingInsights(it.id);
    try {
      // Chama a função RPC get_ai_insights para buscar os dados reais
      const { data: insights, error } = await supabase.rpc('get_ai_insights', { 
        _organizacao_id: it.organizacao_id, 
        _cod_cliente: it.cliente_id || it.cliente_nome 
      });
      
      if (error) throw error;

      // Salva no planejamento para acesso offline
      await supabase.from("planejamento_semanal")
        .update({ local_insights: insights })
        .eq("id", it.id);
      
      toast.success(`Briefing de ${it.cliente_nome} pronto para uso offline!`);
      load();
    } catch (e: any) {
      toast.error("Erro ao preparar briefing: " + e.message);
    } finally {
      setLoadingInsights(null);
    }
  };

  if (diaIdx === 6) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Plano de hoje ({DIAS[diaIdx]})</h2>
        <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20">Offline Ready</Badge>
      </div>
      
      {items.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum cliente planejado para hoje.</p>}
      
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="p-3 rounded-2xl border bg-card/50 hover:bg-accent/5 transition-colors space-y-2">
            <div className="flex items-center gap-3">
              <Checkbox checked={it.visitado} onCheckedChange={() => toggle(it)} className="h-5 w-5 rounded-md" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${it.visitado ? "line-through text-muted-foreground opacity-60" : "text-foreground"}`}>
                  {it.cliente_nome}
                </p>
                {it.cidade && <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{it.cidade}</p>}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 rounded-xl", 
                  it.local_insights?.churn_risk ? "text-emerald-500 bg-emerald-500/10" : "text-primary/40"
                )}
                onClick={() => gerarBriefingOffline(it)}
                disabled={loadingInsights === it.id}
              >
                {loadingInsights === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>

            {it.local_insights && Object.keys(it.local_insights).length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">Briefing Inteligente</span>
                  <Badge variant="outline" className={cn(
                    "text-[8px] h-4",
                    it.local_insights.churn_risk === 'High' ? "bg-red-500/10 text-red-600 border-red-200" :
                    it.local_insights.churn_risk === 'Medium' ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                    "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                  )}>
                    Risco {it.local_insights.churn_risk}
                  </Badge>
                </div>
                {it.local_insights.next_best_offer && (
                  <p className="text-[11px] font-bold text-primary leading-tight">
                    💡 <span className="text-muted-foreground font-medium">Sugerir:</span> {it.local_insights.next_best_offer}
                  </p>
                )}
                <div className="flex flex-col gap-1">
                  {(it.local_insights.insights || []).map((ins: string, idx: number) => (
                    <p key={idx} className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <span className="text-primary mt-1">•</span> {ins}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- PLANEJAR ---------------- */
function PlanejarTab({ userId }: { userId?: string }) {
  const [sub, setSub] = useState("semana");
  return (
    <div className="space-y-3">
      <CicloTutorial />
      <Tabs value={sub} onValueChange={setSub} className="w-full">
      <TabsList className="grid grid-cols-4 w-full h-10">
        <TabsTrigger value="mes" className="text-xs">Mês</TabsTrigger>
        <TabsTrigger value="semana" className="text-xs">Semana</TabsTrigger>
        <TabsTrigger value="dia" className="text-xs">Dia</TabsTrigger>
        <TabsTrigger value="smart" className="text-xs">SMART</TabsTrigger>
      </TabsList>
      <TabsContent value="mes" className="mt-3 space-y-3"><PlanejarMes userId={userId} /></TabsContent>
      <TabsContent value="semana" className="mt-3 space-y-3"><PlanejarSemana userId={userId} /></TabsContent>
      <TabsContent value="dia" className="mt-3 space-y-3"><PlanejarDia userId={userId} /></TabsContent>
      <TabsContent value="smart" className="mt-3 space-y-3"><PlanejarSmart userId={userId} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- REGISTRAR ---------------- */
function RegistrarTab({ userId }: { userId?: string }) {
  const { orgId } = useOrg();
  const [tipo, setTipo] = useState<Tipo>("visita");
  const [cliente, setCliente] = useState<ItemSelecionado | null>(null);
  const [produtoSel, setProdutoSel] = useState<ItemSelecionado | null>(null);
  const [obs, setObs] = useState("");
  const [proxPasso, setProxPasso] = useState("");
  const [proxData, setProxData] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState<ResultadoVal | "">("");
  const [motivo, setMotivo] = useState<string>("");
  const [motivoDetalhe, setMotivoDetalhe] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          }
        }
        if (finalText.trim()) {
          setObs(prev => (prev ? prev + " " : "") + finalText.trim());
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        setIsListening(false);
        toast.error("Erro ao acessar microfone.");
      };
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      return toast.error("Reconhecimento de voz não suportado neste navegador.");
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      toast.info("Ouvindo... Fale agora.");
    }
  };

  const resetForm = (manterCliente = false) => {
    if (!manterCliente) setCliente(null);
    setProdutoSel(null);
    setObs(""); setProxPasso(""); setProxData(""); setResultado("");
    setQuantidade(""); setValor(""); setMotivo(""); setMotivoDetalhe("");
  };

  const submit = async () => {
    if (!userId || !orgId) return;
    if (!cliente?.id) return toast.error("Selecione ou cadastre o cliente");
    if (!resultado) return toast.error("Selecione o resultado");

    // Validações por resultado
    if (resultado === "negativo" && !motivo) {
      return toast.error("Informe o motivo (Negativo exige motivo)");
    }
    if (resultado === "followup" && (!proxPasso || !proxData)) {
      return toast.error("Follow-up exige próxima ação e data prevista");
    }

    // Neutro: sugerir retorno em 15 dias se vazio
    let proxDataFinal = proxData;
    if (resultado === "neutro" && !proxDataFinal) {
      const d = new Date(); d.setDate(d.getDate() + 15);
      proxDataFinal = format(d, "yyyy-MM-dd");
    }

    const labelRes = RESULTADOS.find(r => r.value === resultado)?.label;
    const obsFinal = [
      labelRes && `[${labelRes}]`,
      motivo && `Motivo: ${MOTIVOS_PERDA.find(m => m.value === motivo)?.label}${motivoDetalhe ? ` — ${motivoDetalhe}` : ""}`,
      obs,
    ].filter(Boolean).join(" ") || null;

    const payload: any = {
      user_id: userId, organizacao_id: orgId, tipo,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      observacao: obsFinal,
      proximo_passo: proxPasso || null,
      proxima_data: proxDataFinal || null,
      motivo_perda: resultado === "negativo" ? motivo : null,
    };

    // Pipeline de oportunidades: define etapa automaticamente
    let etapaPipeline: string | null = null;
    if (resultado === "negativo") {
      etapaPipeline = "perdido";
    } else if (tipo === "pedido") {
      etapaPipeline = "proposta";
    } else if (tipo === "proposta") {
      etapaPipeline = "proposta";
    } else if (resultado === "positivo" || resultado === "followup") {
      etapaPipeline = "qualificacao";
    } else if (tipo === "visita" || tipo === "ligacao" || tipo === "reuniao" || tipo === "email") {
      etapaPipeline = "prospeccao";
    }
    if (etapaPipeline) {
      payload.etapa_pipeline = etapaPipeline;
      payload.titulo_oportunidade = cliente.nome;
      payload.etapa_atualizada_em = new Date().toISOString();
      
      // Lógica de Inteligência: Refinar etapa baseado no conteúdo das observações
      const texto = (obsFinal || "").toLowerCase();
      if (texto.includes("fechado") || texto.includes("fechei") || texto.includes("concluído")) {
        payload.etapa_pipeline = "ganho";
      } else if (texto.includes("orçamento") || texto.includes("cotação") || texto.includes("preço enviado")) {
        payload.etapa_pipeline = "proposta";
      } else if (texto.includes("interessado") || texto.includes("demonstração")) {
        payload.etapa_pipeline = "qualificacao";
      }
    }

    if (tipo === "pedido") {
      if (!produtoSel?.id) return toast.error("Selecione ou cadastre o produto");
      const linhaProd = produtoSel.extra?.categoria;
      payload.linha = [linhaProd, produtoSel.nome].filter(Boolean).join(" — ");
      payload.volume_kg = quantidade ? Number(quantidade) : null;
      payload.valor = valor ? Number(valor) : null;
      payload.status_pedido = "orcamento";
    }
    const { error } = await supabase.from("interacoes").insert(payload);
    if (error) return toast.error(error.message);

    // Fluxos por resultado
    if (resultado === "negativo") {
      // Cria alerta para o gestor
      await supabase.from("alertas_rc").insert({
        organizacao_id: orgId,
        user_id: userId,
        cliente_nome: cliente.nome,
        cliente_id: cliente.id,
        tipo: "resultado_negativo",
        severidade: "media",
        titulo: `Resultado negativo: ${cliente.nome}`,
        descricao: obsFinal,
        motivo_categoria: motivo === "preco" || motivo === "credito" ? "comercial"
                        : motivo === "prazo_entrega" ? "logistica"
                        : motivo === "produto" ? "produto"
                        : "outro",
        motivo_detalhe: motivoDetalhe || MOTIVOS_PERDA.find(m => m.value === motivo)?.label,
        mes_referencia: format(new Date(), "yyyy-MM"),
        status: "respondido",
        respondido_em: new Date().toISOString(),
      });
      toast.success("Registrado. Alerta enviado ao gestor.");
      resetForm();
    } else if (resultado === "positivo" && tipo !== "pedido") {
      toast.success("Resultado positivo registrado!", {
        action: {
          label: "Registrar Pedido",
          onClick: () => {
            setTipo("pedido");
            // mantém cliente selecionado
            setObs(""); setProxPasso(""); setProxData(""); setResultado("");
            setMotivo(""); setMotivoDetalhe("");
          },
        },
      });
      resetForm(true);
    } else if (resultado === "followup") {
      toast.success(`Follow-up agendado para ${format(new Date(proxDataFinal!), "dd/MM/yyyy")}`);
      resetForm();
    } else if (resultado === "neutro") {
      toast.success(`Registrado. Retorno sugerido: ${format(new Date(proxDataFinal!), "dd/MM/yyyy")}`);
      resetForm();
    } else {
      toast.success("Registrado!");
      resetForm();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-1">
        <ClipboardEdit className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold leading-tight">Registro de Campo</h2>
          <p className="text-xs text-muted-foreground">Registre atividades rapidamente durante visitas e ligações</p>
        </div>
      </div>

      <Card className="p-4 space-y-5">
        <div>
          <p className="text-sm font-semibold mb-1">Nova Atividade</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Tipo de Atividade</Label>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(TIPO_LABEL) as Tipo[]).filter(t => t !== "tarefa").map((t) => {
              const Icon = TIPO_ICON[t];
              const ativo = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all ${
                    ativo
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight text-center">
                    {TIPO_LABEL[t].split("/")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs">Cliente <span className="text-destructive">*</span></Label>
          <MeusClientesPicker userId={userId} value={cliente} onChange={setCliente} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Observações</Label>
            <button
              type="button"
              onClick={toggleVoice}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-primary/10 text-primary hover:bg-primary/20 shadow-sm border border-primary/20"
              }`}
              title={isListening ? "Parar de ouvir" : "Gravar por voz"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{isListening ? "Gravando..." : "Ditar"}</span>
            </button>
          </div>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={4}
            placeholder={isListening ? "Ouvindo..." : "Descreva o que foi discutido, próximos passos..."}
            className={isListening ? "border-red-500 ring-1 ring-red-500" : ""}
          />
        </div>

        {tipo === "pedido" && (
          <div className="space-y-3 p-3 bg-accent/40 rounded-lg border border-border">
            <AutocompleteCadastro
              userId={userId}
              tabela="produtos"
              label="Produto"
              value={produtoSel}
              onChange={setProdutoSel}
              placeholder="Buscar produto…"
            />
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Quantidade</Label><Input type="number" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="kg / sacos" /></div>
              <div><Label className="text-xs">Valor (R$)</Label><Input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs mb-2 block">Resultado <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-4 gap-2">
            {RESULTADOS.map((r) => {
              const ativo = resultado === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setResultado(r.value)}
                  className={`py-2.5 px-1 rounded-lg border-2 text-xs font-semibold transition-all ${ativo ? r.clsAtivo : `bg-card ${r.cls}`}`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {resultado === "negativo" && (
          <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <Label className="text-xs">Motivo da perda <span className="text-destructive">*</span></Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecionar motivo..." /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_PERDA.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={motivoDetalhe} onChange={(e) => setMotivoDetalhe(e.target.value)} placeholder="Detalhes (opcional)" />
            <p className="text-[11px] text-red-700 dark:text-red-400">⚠️ Um alerta será enviado ao gestor.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">
              Próxima Ação {resultado === "followup" && <span className="text-destructive">*</span>}
            </Label>
            <Input value={proxPasso} onChange={(e) => setProxPasso(e.target.value)} placeholder="Ex: Enviar proposta em 3 dias" />
          </div>
          <div>
            <Label className="text-xs">
              Data prevista {resultado === "followup" && <span className="text-destructive">*</span>}
              {resultado === "neutro" && <span className="text-muted-foreground"> (sugerido +15d)</span>}
            </Label>
            <Input type="date" value={proxData} onChange={(e) => setProxData(e.target.value)} />
          </div>
        </div>

        <Button onClick={submit} size="lg" className="w-full h-12 text-base font-semibold">
          <Plus className="mr-2 h-5 w-5" />Registrar Atividade
        </Button>
      </Card>

      <AtividadesRecentes userId={userId} />
    </>
  );
}

function AtividadesRecentes({ userId }: { userId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!userId) return;
    supabase.from("interacoes").select("*").eq("user_id", userId)
      .order("data", { ascending: false }).limit(5)
      .then(({ data }) => setItems(data ?? []));
  }, [userId]);

  if (items.length === 0) return null;

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Atividades Recentes</h3>
      </div>
      {items.map((it) => {
        const Icon = TIPO_ICON[it.tipo as Tipo] ?? MapPin;
        return (
          <div key={it.id} className="flex items-start gap-3 py-2 border-t first:border-t-0">
            <div className="p-1.5 rounded-md bg-accent mt-0.5"><Icon className="h-3.5 w-3.5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{TIPO_LABEL[it.tipo as Tipo] ?? it.tipo}</p>
              <p className="text-xs text-muted-foreground truncate">{it.cliente_nome}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
              {formatDistanceToNow(new Date(it.data), { locale: ptBR, addSuffix: false })}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

/* ---------------- HISTÓRICO ---------------- */
function HistoricoTab({ userId }: { userId?: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<Tipo | "todos">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "orcamento" | "vendido" | "perdido">("todos");
  const [perdaId, setPerdaId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const load = async () => {
    if (!userId) return;
    let q = supabase.from("interacoes").select("*").eq("user_id", userId).order("data", { ascending: false }).limit(50);
    if (filtroStatus !== "todos") {
      q = q.eq("tipo", "pedido");
      if (filtroStatus === "orcamento") {
        // inclui registros antigos sem status_pedido
        q = q.or("status_pedido.eq.orcamento,status_pedido.is.null");
      } else {
        q = q.eq("status_pedido", filtroStatus);
      }
    } else if (filtro !== "todos") {
      q = q.eq("tipo", filtro);
    }
    const { data } = await q;
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [userId, filtro, filtroStatus]);

  const marcarVendido = async (id: string) => {
    const { error } = await supabase.from("interacoes")
      .update({ status_pedido: "vendido", convertido_em: new Date().toISOString(), motivo_perda: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pedido convertido em venda!");
    load();
  };

  const confirmarPerda = async () => {
    if (!perdaId) return;
    const { error } = await supabase.from("interacoes")
      .update({ status_pedido: "perdido", motivo_perda: motivo.trim() || null, convertido_em: null })
      .eq("id", perdaId);
    if (error) return toast.error(error.message);
    toast.success("Marcado como perdido");
    setPerdaId(null); setMotivo("");
    load();
  };

  const reabrir = async (id: string) => {
    const { error } = await supabase.from("interacoes")
      .update({ status_pedido: "orcamento", convertido_em: null, motivo_perda: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Voltou para orçamento");
    load();
  };

  const statusBadge = (s?: string) => {
    if (s === "vendido") return <Badge className="text-[10px] bg-primary hover:bg-primary text-primary-foreground">Vendido</Badge>;
    if (s === "perdido") return <Badge variant="destructive" className="text-[10px]">Perdido</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Orçamento</Badge>;
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Select value={filtro} onValueChange={(v: any) => setFiltro(v)} disabled={filtroStatus !== "todos"}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.keys(TIPO_LABEL) as Tipo[]).map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
          <SelectTrigger><SelectValue placeholder="Status pedido" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="orcamento">Só orçamentos</SelectItem>
            <SelectItem value="vendido">Só vendidos</SelectItem>
            <SelectItem value="perdido">Só perdidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro ainda.</p>}
      {items.map((it) => {
        const Icon = TIPO_ICON[it.tipo as Tipo] ?? MapPin;
        return (
          <Card key={it.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 rounded-lg bg-accent"><Icon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{it.cliente_nome}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{format(new Date(it.data), "dd/MM HH:mm")}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-muted-foreground">{TIPO_LABEL[it.tipo as Tipo]}</p>
                  {it.tipo === "pedido" && statusBadge(it.status_pedido)}
                </div>
                {it.observacao && <p className="text-xs mt-1">{it.observacao}</p>}
                {it.tipo === "pedido" && (it.volume_kg || it.valor) && (
                  <p className="text-xs mt-1 font-medium">
                    {it.linha && `${it.linha} • `}
                    {it.volume_kg && `${Number(it.volume_kg).toLocaleString("pt-BR")} kg`}
                    {it.valor && ` • R$ ${Number(it.valor).toLocaleString("pt-BR")}`}
                  </p>
                )}
                {it.tipo === "pedido" && it.motivo_perda && (
                  <p className="text-[11px] text-destructive mt-1">Motivo: {it.motivo_perda}</p>
                )}
                {it.proximo_passo && (
                  <div className="mt-2 p-2 bg-muted rounded text-[11px]">
                    <span className="font-medium">Próximo passo:</span> {it.proximo_passo}
                    {it.proxima_data && ` (${format(new Date(it.proxima_data), "dd/MM")})`}
                  </div>
                )}
                {it.tipo === "pedido" && (
                  <div className="flex gap-2 mt-2">
                    {(!it.status_pedido || it.status_pedido === "orcamento") ? (
                      <>
                        <Button size="sm" className="flex-1" onClick={() => marcarVendido(it.id)}>
                          <Check className="mr-1 h-3.5 w-3.5" />Vendido
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPerdaId(it.id); setMotivo(""); }}>
                          <X className="mr-1 h-3.5 w-3.5" />Perdido
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-[11px]" onClick={() => reabrir(it.id)}>
                        Reabrir como orçamento
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Dialog open={perdaId !== null} onOpenChange={(o) => !o && setPerdaId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar pedido como perdido</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo (opcional)</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: preço, prazo, concorrência…" />
            </div>
            <Button onClick={confirmarPerda} variant="destructive" className="w-full">
              <X className="mr-2 h-4 w-4" />Confirmar perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}