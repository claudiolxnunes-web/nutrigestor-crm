import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rcUserId: string | null;
  rcNome: string;
  codRc: string | null;
  mes: string; // YYYY-MM
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function RcDrilldownDialog({ open, onOpenChange, rcUserId, rcNome, codRc, mes }: Props) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [planoSemana, setPlanoSemana] = useState<any[]>([]);
  const [smarts, setSmarts] = useState<any[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [acoes, setAcoes] = useState<any[]>([]);
  const [novaAcao, setNovaAcao] = useState({ titulo: "", descricao: "", prioridade: "media", data_alvo: "" });
  const [salvando, setSalvando] = useState(false);

  const semanaInicio = startOfWeek(new Date(), { weekStartsOn: 1 });

  const load = async () => {
    if (!rcUserId) return;
    setLoading(true);
    const inicioMes = `${mes}-01`;
    const fimMes = format(endOfMonth(new Date(`${mes}-01T00:00:00`)), "yyyy-MM-dd");
    const [p, s, i, a] = await Promise.all([
      supabase.from("planejamento_semanal").select("*")
        .eq("user_id", rcUserId)
        .eq("semana_inicio", format(semanaInicio, "yyyy-MM-dd"))
        .order("dia_semana").order("ordem"),
      supabase.from("objetivos_smart").select("*").eq("user_id", rcUserId).eq("mes_ano", mes),
      supabase.from("interacoes").select("*").eq("user_id", rcUserId)
        .gte("data", inicioMes).lte("data", `${fimMes}T23:59:59`)
        .order("data", { ascending: false }).limit(20),
      supabase.from("acoes_gestor").select("*").eq("rc_user_id", rcUserId).order("created_at", { ascending: false }),
    ]);
    setPlanoSemana(p.data ?? []);
    setSmarts(s.data ?? []);
    setInteracoes(i.data ?? []);
    setAcoes(a.data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, rcUserId, mes]);

  const criarAcao = async () => {
    if (!user || !orgId || !rcUserId) return;
    if (!novaAcao.titulo.trim()) return toast.error("Título obrigatório");
    setSalvando(true);
    const { error } = await supabase.from("acoes_gestor").insert({
      organizacao_id: orgId,
      gestor_id: user.id,
      rc_user_id: rcUserId,
      rc_nome: rcNome,
      titulo: novaAcao.titulo.trim().slice(0, 200),
      descricao: novaAcao.descricao.trim().slice(0, 1000) || null,
      prioridade: novaAcao.prioridade,
      data_alvo: novaAcao.data_alvo || null,
    });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Ação registrada");
    setNovaAcao({ titulo: "", descricao: "", prioridade: "media", data_alvo: "" });
    load();
  };

  const concluirAcao = async (id: string, concluida: boolean) => {
    await supabase.from("acoes_gestor").update({
      status: concluida ? "concluida" : "aberta",
      concluida_em: concluida ? new Date().toISOString() : null,
    }).eq("id", id);
    load();
  };

  const deletarAcao = async (id: string) => {
    await supabase.from("acoes_gestor").delete().eq("id", id);
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
        <DialogHeader className="p-6 md:p-8 pb-0 text-left border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02]">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-primary/5 rounded-[18px]">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">
                {rcNome.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">{rcNome}</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Cód. RC: <span className="font-mono">{codRc ?? "—"}</span> • Mês: {mes}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-0 max-h-[75vh] overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
          ) : (
            <Tabs defaultValue="plano" className="w-full">
              <div className="px-6 md:px-8 pt-6">
                <div className="overflow-x-auto -mx-6 px-6 mb-4 scrollbar-none">
                  <TabsList className="w-full flex justify-start min-w-max h-12 p-1 bg-slate-100/50 dark:bg-white/5 rounded-xl">
                    <TabsTrigger value="plano" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Plano Semanal</TabsTrigger>
                    <TabsTrigger value="smart" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">SMART</TabsTrigger>
                    <TabsTrigger value="atividades" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Atividades</TabsTrigger>
                    <TabsTrigger value="acoes" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">
                      Ações ({acoes.filter(a => a.status === "aberta").length})
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <TabsContent value="plano" className="px-6 md:px-8 pb-8 mt-2 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Semana de {format(semanaInicio, "dd/MM", { locale: ptBR })} a {format(addDays(semanaInicio, 5), "dd/MM/yyyy", { locale: ptBR })}
                </p>
                {planoSemana.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground text-center">Sem planejamento para esta semana.</Card>
                ) : DIAS.map((d, idx) => {
                  const itens = planoSemana.filter((p) => p.dia_semana === idx);
                  if (itens.length === 0) return null;
                  const feitos = itens.filter((i) => i.visitado).length;
                  return (
                    <Card key={idx} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold">{d}</p>
                        <span className="text-xs text-muted-foreground">{feitos}/{itens.length} visitados</span>
                      </div>
                      {itens.map((it) => (
                        <div key={it.id} className="flex items-center gap-2 py-1 text-sm">
                          <span className={it.visitado ? "text-primary" : "text-muted-foreground"}>{it.visitado ? "✓" : "○"}</span>
                          <span className={it.visitado ? "line-through text-muted-foreground" : ""}>{it.cliente_nome}</span>
                          {it.cidade && <span className="text-xs text-muted-foreground">• {it.cidade}</span>}
                        </div>
                      ))}
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="smart" className="px-6 md:px-8 pb-8 mt-2 space-y-4">
                {smarts.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground text-center">Nenhum objetivo SMART em {mes}.</Card>
                ) : smarts.map((s) => (
                  <Card key={s.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{s.especifico}</p>
                      <Badge variant={s.progresso >= 100 ? "default" : "secondary"}>{Math.round(s.progresso)}%</Badge>
                    </div>
                    {s.mensuravel && <p className="text-xs text-muted-foreground">📊 {s.mensuravel}</p>}
                    {s.prazo && <p className="text-xs text-muted-foreground">📅 {format(new Date(s.prazo + "T00:00:00"), "dd/MM/yyyy")}</p>}
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="atividades" className="px-6 md:px-8 pb-8 mt-2 space-y-4">
                {interacoes.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground text-center">Sem registros em {mes}.</Card>
                ) : interacoes.map((it) => (
                  <Card key={it.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{it.tipo} — {it.cliente_nome}</p>
                      <span className="text-xs text-muted-foreground">{format(new Date(it.data), "dd/MM HH:mm")}</span>
                    </div>
                    {it.observacao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.observacao}</p>}
                    {it.valor && <p className="text-xs mt-1">Valor: {fmtBRL(Number(it.valor))}</p>}
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="acoes" className="px-6 md:px-8 pb-8 mt-2 space-y-4">
                <Card className="p-4 space-y-4 bg-accent/30 border-accent">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Nova ação para {rcNome}</p>
                  <div className="space-y-3">
                    <Input
                      placeholder="Título da ação"
                      value={novaAcao.titulo}
                      className="bg-white dark:bg-slate-900 border-transparent h-12 rounded-xl"
                      onChange={(e) => setNovaAcao({ ...novaAcao, titulo: e.target.value.slice(0, 200) })}
                    />
                    <Textarea
                      placeholder="Detalhes e orientações"
                      rows={2}
                      className="bg-white dark:bg-slate-900 border-transparent rounded-xl resize-none"
                      value={novaAcao.descricao}
                      onChange={(e) => setNovaAcao({ ...novaAcao, descricao: e.target.value.slice(0, 1000) })}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Prioridade</Label>
                        <Select value={novaAcao.prioridade} onValueChange={(v) => setNovaAcao({ ...novaAcao, prioridade: v })}>
                          <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-transparent rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-premium">
                            <SelectItem value="baixa" className="rounded-lg">Baixa</SelectItem>
                            <SelectItem value="media" className="rounded-lg">Média</SelectItem>
                            <SelectItem value="alta" className="rounded-lg">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Prazo Alvo</Label>
                        <Input type="date" value={novaAcao.data_alvo} className="h-12 bg-white dark:bg-slate-900 border-transparent rounded-xl" onChange={(e) => setNovaAcao({ ...novaAcao, data_alvo: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <Button onClick={criarAcao} disabled={salvando} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:shadow-primary/20 transition-all">
                    {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Adicionar ação
                  </Button>
                </Card>

                <div className="space-y-3">
                  {acoes.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-10 italic">Nenhuma ação registrada.</p>
                  ) : acoes.map((a) => (
                    <Card key={a.id} className={`p-4 border-slate-100 dark:border-white/5 shadow-sm transition-opacity ${a.status === "concluida" ? "opacity-50" : ""}`}>
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={a.status === "concluida"}
                          onCheckedChange={(c) => concluirAcao(a.id, !!c)}
                          className="h-5 w-5 rounded-md mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-bold text-slate-900 dark:text-white ${a.status === "concluida" ? "line-through" : ""}`}>{a.titulo}</p>
                            <Badge variant={a.prioridade === "alta" ? "destructive" : a.prioridade === "media" ? "default" : "secondary"} className="text-[9px] font-black uppercase tracking-tighter h-5">
                              {a.prioridade}
                            </Badge>
                            {a.data_alvo && <span className="text-[10px] font-bold text-slate-400">📅 {format(new Date(a.data_alvo + "T00:00:00"), "dd/MM")}</span>}
                          </div>
                          {a.descricao && <p className="text-xs text-slate-500 leading-relaxed">{a.descricao}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg" onClick={() => deletarAcao(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}