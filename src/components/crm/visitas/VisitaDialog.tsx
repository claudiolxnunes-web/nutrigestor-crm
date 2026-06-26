import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MapPin, Camera, Loader2, Play, Square, Mic, MicOff, Star, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { MeusClientesPicker } from "@/components/crm/MeusClientesPicker";
import type { ItemSelecionado } from "@/components/crm/AutocompleteCadastro";
import { useVisitas, type Visita } from "@/hooks/crm/useVisitas";
import { MOTIVOS_PERDA } from "@/hooks/crm/useOportunidades";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  visita?: Visita | null;
  defaultDate?: string;
};

const CATEGORIAS = [
  { v: "prospeccao", l: "Prospecção" },
  { v: "manutencao", l: "Manutenção" },
  { v: "recuperacao", l: "Recuperação" },
  { v: "retorno", l: "Retorno técnico" },
];

const SPIN_OPTIONS = {
  situacao: ["Cliente ativo", "Inativo > 6 meses", "Novo prospecto", "Usa concorrente", "Expandindo área"],
  problema: ["Preço alto", "Logística lenta", "Baixa produtividade", "Falta assistência", "Qualidade oscilante"],
  implicacao: ["Perda de margem", "Risco de quebra", "Atraso no plantio", "Custo operacional alto", "Solo degradado"],
  necessidade: ["Reduzir custos", "Aumentar produção", "Suporte técnico", "Agilizar entrega", "Testar nova linha"],
};

export function VisitaDialog({ open, onOpenChange, visita, defaultDate }: Props) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { representativeCode, representativeName } = useRole();
  const { upsert } = useVisitas();

  const [cliente, setCliente] = useState<ItemSelecionado | null>(null);
  const [data, setData] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("manutencao");
  const [spinS, setSpinS] = useState("");
  const [spinP, setSpinP] = useState("");
  const [spinI, setSpinI] = useState("");
  const [spinN, setSpinN] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [resultado, setResultado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [proxPasso, setProxPasso] = useState("");
  const [proxData, setProxData] = useState("");
  const [gerouPedido, setGerouPedido] = useState(false);
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState<Visita["status"]>("planejada");
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [horaFim, setHoraFim] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [etapaPipeline, setEtapaPipeline] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoPerdaOutro, setMotivoPerdaOutro] = useState("");
  const [concorrentePerda, setConcorrentePerda] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSocialProof, setIsSocialProof] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [shouldAnonymize, setShouldAnonymize] = useState(false);
  const [outcomeValue, setOutcomeValue] = useState("");

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return toast.error("Reconhecimento de voz não suportado neste navegador");

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setResultado(prev => prev ? `${prev} ${text}` : text);
      toast.success("Áudio transcrito com sucesso!");
    };

    recognition.start();
  };

  const spinPreview = useMemo(() => {
    const parts = [];
    if (spinS) parts.push(`SITUAÇÃO: ${spinS}`);
    if (spinP) parts.push(`PROBLEMA: ${spinP}`);
    if (spinI) parts.push(`IMPLICAÇÃO: ${spinI}`);
    if (spinN) parts.push(`NECESSIDADE: ${spinN}`);
    return parts.join('\n\n');
  }, [spinS, spinP, spinI, spinN]);

  const autoSalvar = useCallback(async (overrides: any = {}) => {
    if (!cliente?.nome || !orgId || !user || !visita?.id) return;
    setAutoSaving(true);
    try {
      await upsert.mutateAsync({
        id: visita.id,
        cliente_id: cliente.id || null,
        cliente_nome: cliente.nome,
        cidade: cliente.extra?.cidade ?? null,
        uf: cliente.extra?.estado ?? null,
        cod_rc: representativeCode,
        rc_nome: representativeName,
        data_visita: data,
        categoria_spin: categoria,
        spin_situacao: spinS,
        spin_problema: spinP,
        spin_implicacao: spinI,
        spin_necessidade: spinN,
        objetivo, resultado, observacao,
        proximo_passo: proxPasso || null,
        proxima_data: proxData || null,
        gerou_pedido: gerouPedido,
        valor_estimado: valor ? Number(valor) : null,
        status,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        foto_url: fotoUrl,
        etapa_pipeline: etapaPipeline || null,
        motivo_perda: motivoPerda || null,
        motivo_perda_outro: motivoPerdaOutro || null,
        concorrente_perda: concorrentePerda || null,
        ...overrides
      });
    } catch (e) {
      console.error("Auto-save failed", e);
    } finally {
      setAutoSaving(false);
    }
  }, [cliente, orgId, user, visita, representativeCode, representativeName, data, categoria, spinS, spinP, spinI, spinN, objetivo, resultado, observacao, proxPasso, proxData, gerouPedido, valor, status, horaInicio, horaFim, fotoUrl, upsert, etapaPipeline, motivoPerda, motivoPerdaOutro, concorrentePerda]);

  // Hook de debounce para auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Só habilita auto-save se for uma edição de visita existente
    if (!visita?.id || !open) return;

    // Cancela o timer anterior
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Inicia um novo timer de 2 segundos após a última alteração
    autoSaveTimerRef.current = setTimeout(() => {
      autoSalvar();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    data, categoria, spinS, spinP, spinI, spinN, objetivo, resultado, 
    observacao, proxPasso, proxData, gerouPedido, valor, status, 
    horaInicio, horaFim, fotoUrl, etapaPipeline, motivoPerda, 
    motivoPerdaOutro, concorrentePerda, visita?.id, open
  ]);

  const handleChipClick = (type: keyof typeof SPIN_OPTIONS, val: string, current: string, setter: (v: string) => void) => {
    const newVal = current ? `${current}, ${val}` : val;
    setter(newVal);
  };

  useEffect(() => {
    if (visita) {
      setCliente({ id: visita.cliente_id ?? "", nome: visita.cliente_nome, isProspecto: false, extra: { cidade: visita.cidade, estado: visita.uf } });
      setData(visita.data_visita);
      setCategoria(visita.categoria_spin ?? "manutencao");
      setSpinS(visita.spin_situacao ?? "");
      setSpinP(visita.spin_problema ?? "");
      setSpinI(visita.spin_implicacao ?? "");
      setSpinN(visita.spin_necessidade ?? "");
      setObjetivo(visita.objetivo ?? "");
      setResultado(visita.resultado ?? "");
      setObservacao(visita.observacao ?? "");
      setProxPasso(visita.proximo_passo ?? "");
      setProxData(visita.proxima_data ?? "");
      setGerouPedido(visita.gerou_pedido);
      setValor(visita.valor_estimado ? String(visita.valor_estimado) : "");
      setStatus(visita.status);
      setHoraInicio(visita.hora_inicio);
      setHoraFim(visita.hora_fim);
      setLat(visita.lat);
      setLng(visita.lng);
      setFotoUrl(visita.foto_url);
      setEtapaPipeline((visita as any).etapa_pipeline ?? "");
      setMotivoPerda((visita as any).motivo_perda ?? "");
      setMotivoPerdaOutro((visita as any).motivo_perda_outro ?? "");
      setConcorrentePerda((visita as any).concorrente_perda ?? "");
    } else {
      setCliente(null);
      setData(defaultDate ?? new Date().toISOString().slice(0, 10));
      setCategoria("manutencao");
      setSpinS(""); setSpinP(""); setSpinI(""); setSpinN("");
      setObjetivo(""); setResultado(""); setObservacao(""); setProxPasso(""); setProxData("");
      setGerouPedido(false); setValor("");
      setStatus("planejada");
      setHoraInicio(null); setHoraFim(null); setLat(null); setLng(null); setFotoUrl(null);
      setEtapaPipeline(""); setMotivoPerda(""); setMotivoPerdaOutro(""); setConcorrentePerda("");
    }
  }, [visita, open, defaultDate]);

  const captureLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocalização não disponível");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude); setLng(pos.coords.longitude);
        toast.success("Localização capturada");
      },
      () => toast.error("Não foi possível obter localização"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const doCheckIn = () => {
    setHoraInicio(new Date().toISOString());
    setStatus("em_andamento");
    captureLocation();
  };
  const doCheckOut = () => {
    setHoraFim(new Date().toISOString());
    setStatus("realizada");
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("visitas-fotos").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("visitas-fotos").getPublicUrl(path);
    setFotoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Foto enviada");
  };

  const salvar = async () => {
    if (!cliente?.nome) return toast.error("Selecione um cliente");
    if (!orgId || !user) return;
    setSaving(true);
    let dur: number | null = null;
    if (horaInicio && horaFim) {
      dur = Math.round((new Date(horaFim).getTime() - new Date(horaInicio).getTime()) / 60000);
    }
    try {
      await upsert.mutateAsync({
        id: visita?.id,
        cliente_id: cliente.id || null,
        cliente_nome: cliente.nome,
        cidade: cliente.extra?.cidade ?? null,
        uf: cliente.extra?.estado ?? null,
        cod_rc: representativeCode,
        rc_nome: representativeName,
        data_visita: data,
        categoria_spin: categoria,
        spin_situacao: spinS,
        spin_problema: spinP,
        spin_implicacao: spinI,
        spin_necessidade: spinN,
        objetivo, resultado, observacao,
        proximo_passo: proxPasso || null,
        proxima_data: proxData || null,
        gerou_pedido: gerouPedido,
        valor_estimado: valor ? Number(valor) : null,
        status,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        duracao_minutos: dur,
        lat, lng, foto_url: fotoUrl,
        etapa_pipeline: etapaPipeline || null,
        motivo_perda: motivoPerda || null,
        motivo_perda_outro: motivoPerdaOutro || null,
        concorrente_perda: concorrentePerda || null,
      });

      if (isSocialProof && fotoUrl) {
        await supabase.from("social_proof_assets").insert({
          organizacao_id: orgId,
          user_id: user.id,
          cliente_id: cliente.id || null,
          visita_id: visita?.id,
          image_url: fotoUrl,
          titulo: `Resultado: ${cliente.nome}`,
          resultado_valor: outcomeValue,
          lat, lng,
          cidade: cliente.extra?.cidade,
          estado: cliente.extra?.estado,
          consentimento_divulgacao: hasConsent,
          anonimizar_dados: shouldAnonymize
        });
      }
      toast.success(visita ? "Visita atualizada" : "Visita registrada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visita ? "Editar visita" : "Nova visita"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Cliente</Label>
            <MeusClientesPicker userId={user?.id} value={cliente} onChange={setCliente} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Categoria</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CATEGORIAS.map((c) => (
                  <Button
                    key={c.v}
                    type="button"
                    size="sm"
                    variant={categoria === c.v ? "default" : "outline"}
                    className="h-7 text-[10px] px-2"
                    onClick={() => setCategoria(c.v)}
                  >
                    {c.l}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Objetivo da visita</Label>
            <Textarea rows={2} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex.: apresentar nova linha de nutrição, recuperar volume..." />
          </div>

          {/* Check-in / Check-out */}
          <div className="rounded-lg border bg-accent/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execução</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={horaInicio ? "secondary" : "default"} onClick={doCheckIn} disabled={!!horaInicio}>
                <Play className="h-3 w-3 mr-1" /> Check-in {horaInicio && `(${new Date(horaInicio).toLocaleTimeString().slice(0,5)})`}
              </Button>
              <Button size="sm" variant={horaFim ? "secondary" : "default"} onClick={doCheckOut} disabled={!horaInicio || !!horaFim}>
                <Square className="h-3 w-3 mr-1" /> Check-out {horaFim && `(${new Date(horaFim).toLocaleTimeString().slice(0,5)})`}
              </Button>
              <Button size="sm" variant="outline" onClick={captureLocation}>
                <MapPin className="h-3 w-3 mr-1" /> {lat ? `${lat.toFixed(4)},${lng?.toFixed(4)}` : "Capturar local"}
              </Button>
              <label className="inline-flex items-center gap-1 h-9 px-3 rounded-md border bg-background text-xs font-medium cursor-pointer hover:bg-accent">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                {fotoUrl ? "Trocar foto" : "Foto"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
              </label>
            </div>
            {fotoUrl && (
              <div className="space-y-3">
                <div className="relative group inline-block">
                  <img src={fotoUrl} alt="foto visita" className="h-40 rounded-2xl object-cover border-2 border-primary/10 shadow-lg" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                    <Button size="sm" variant="secondary" className="h-8 text-[10px] font-bold" onClick={() => window.open(fotoUrl, '_blank')}>Visualizar Full</Button>
                  </div>
                </div>

                <div className={cn(
                  "p-4 rounded-3xl border-2 transition-all duration-500",
                  isSocialProof ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]" : "bg-white/5 border-dashed border-white/10"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Star className={cn("h-4 w-4", isSocialProof ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                      <span className="text-[11px] font-black uppercase tracking-widest">Transformar em Prova Social</span>
                    </div>
                    <Switch checked={isSocialProof} onCheckedChange={setIsSocialProof} />
                  </div>
                  
                  {isSocialProof && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] uppercase font-black text-amber-500">Autorização</Label>
                            <Switch checked={hasConsent} onCheckedChange={setHasConsent} className="scale-75" />
                          </div>
                          <p className="text-[8px] text-muted-foreground leading-tight">Cliente autorizou o uso do nome e dados da fazenda.</p>
                        </div>
                        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] uppercase font-black text-blue-500">Anonimizar</Label>
                            <Switch checked={shouldAnonymize} onCheckedChange={setShouldAnonymize} className="scale-75" />
                          </div>
                          <p className="text-[8px] text-muted-foreground leading-tight">Remover nome e localização exata ao compartilhar.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Resultado Alcançado</Label>
                          <Input 
                            placeholder="Ex: +2.5kg/dia" 
                            className="h-8 text-xs rounded-xl" 
                            value={outcomeValue}
                            onChange={(e) => setOutcomeValue(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Categoria</Label>
                          <Select defaultValue="nutricao">
                            <SelectTrigger className="h-8 text-xs rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nutricao">Nutrição</SelectItem>
                              <SelectItem value="pastagem">Pastagem</SelectItem>
                              <SelectItem value="sanidade">Sanidade</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button 
                        size="sm" 
                        disabled={!hasConsent && !shouldAnonymize}
                        className={cn(
                          "w-full h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2 transition-all",
                          hasConsent || shouldAnonymize ? "bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        <Share2 className="h-3 w-3" /> Gerar Card de Sucesso (WhatsApp)
                      </Button>
                      {!hasConsent && !shouldAnonymize && (
                        <p className="text-[8px] text-rose-500 font-bold text-center">⚠️ Requer autorização ou anonimização para divulgar.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Resultado / o que aconteceu</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className={cn("h-7 text-[10px] font-bold px-2 gap-1.5", isListening && "text-rose-500 animate-pulse")}
                onClick={startListening}
              >
                {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {isListening ? "Ouvindo..." : "Ditar Resultado (IA)"}
              </Button>
            </div>
            <Textarea rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Resumo do que foi tratado..." />
          </div>
          <div className="space-y-3 rounded-lg border p-3 bg-slate-50/50">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Relatório SPIN
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase">S - Situação (Contexto)</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {SPIN_OPTIONS.situacao.map(opt => (
                    <button key={opt} type="button" onClick={() => handleChipClick('situacao', opt, spinS, setSpinS)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 hover:bg-primary/20 transition-colors whitespace-nowrap">
                      + {opt}
                    </button>
                  ))}
                </div>
                <Textarea rows={2} value={spinS} onChange={(e) => setSpinS(e.target.value)} className="text-xs" placeholder="Como o cliente está hoje?" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase">P - Problema (Dores)</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {SPIN_OPTIONS.problema.map(opt => (
                    <button key={opt} type="button" onClick={() => handleChipClick('problema', opt, spinP, setSpinP)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 hover:bg-primary/20 transition-colors whitespace-nowrap">
                      + {opt}
                    </button>
                  ))}
                </div>
                <Textarea rows={2} value={spinP} onChange={(e) => setSpinP(e.target.value)} className="text-xs" placeholder="Quais dificuldades identificou?" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase">I - Implicação (Impacto)</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {SPIN_OPTIONS.implicacao.map(opt => (
                    <button key={opt} type="button" onClick={() => handleChipClick('implicacao', opt, spinI, setSpinI)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 hover:bg-primary/20 transition-colors whitespace-nowrap">
                      + {opt}
                    </button>
                  ))}
                </div>
                <Textarea rows={2} value={spinI} onChange={(e) => setSpinI(e.target.value)} className="text-xs" placeholder="O que acontece se não resolver?" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase">N - Necessidade de Solução</Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {SPIN_OPTIONS.necessidade.map(opt => (
                    <button key={opt} type="button" onClick={() => handleChipClick('necessidade', opt, spinN, setSpinN)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 hover:bg-primary/20 transition-colors whitespace-nowrap">
                      + {opt}
                    </button>
                  ))}
                </div>
                <Textarea rows={2} value={spinN} onChange={(e) => setSpinN(e.target.value)} className="text-xs" placeholder="Quais os benefícios da sua solução?" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] text-primary font-bold uppercase flex items-center gap-2">
                  Pré-visualização do Relatório SPIN
                </Label>
                <div className="p-3 rounded border bg-white/50 text-xs font-mono whitespace-pre-wrap min-h-[60px] max-h-[150px] overflow-y-auto shadow-inner">
                  {spinPreview || <span className="text-muted-foreground italic text-[10px]">Preencha os campos acima para gerar o resumo consolidado...</span>}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações Adicionais</Label>
            <Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className="text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Próximo passo</Label>
              <Input value={proxPasso} onChange={(e) => setProxPasso(e.target.value)} placeholder="Ex.: enviar proposta" />
            </div>
            <div>
              <Label className="text-xs">Data próximo passo</Label>
              <Input type="date" value={proxData} onChange={(e) => setProxData(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border p-3 bg-indigo-50/30 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
              Pipeline de Oportunidade
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Etapa do Funil</Label>
                <Select value={etapaPipeline} onValueChange={setEtapaPipeline}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione a etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospeccao">Prospecção</SelectItem>
                    <SelectItem value="qualificacao">Qualificação</SelectItem>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="ganho">Ganho (Vendido)</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {etapaPipeline === "perdido" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Motivo da Perda</Label>
                  <Select value={motivoPerda} onValueChange={setMotivoPerda}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_PERDA.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {etapaPipeline === "perdido" && motivoPerda === "concorrente" && (
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Concorrente</Label>
                <Input 
                  value={concorrentePerda} 
                  onChange={(e) => setConcorrentePerda(e.target.value)} 
                  className="h-8 text-xs" 
                  placeholder="Nome do concorrente..." 
                />
              </div>
            )}

            {etapaPipeline === "perdido" && (
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase">Detalhes da Perda</Label>
                <Textarea 
                  value={motivoPerdaOutro} 
                  onChange={(e) => setMotivoPerdaOutro(e.target.value)} 
                  className="text-xs" 
                  placeholder="Descreva o motivo da perda..." 
                  rows={2}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 items-end pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch checked={gerouPedido} onCheckedChange={setGerouPedido} id="gerou" />
                <Label htmlFor="gerou" className="text-xs">Gerou pedido</Label>
              </div>
              <div>
                <Label className="text-xs">Valor estimado (R$)</Label>
                <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} disabled={!gerouPedido} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {["planejada", "em_andamento", "realizada", "cancelada"].map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  className="h-8 text-[11px] capitalize"
                  onClick={() => setStatus(s as any)}
                >
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div className="flex items-center text-[10px] text-muted-foreground">
            {autoSaving ? (
              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</span>
            ) : visita?.id ? (
              <span>Alterações salvas automaticamente</span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Salvar e Sair
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}