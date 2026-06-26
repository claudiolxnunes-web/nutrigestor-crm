import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Loader2, MapPin, TrendingDown, XCircle } from "lucide-react";
import { toast } from "sonner";

export type Alerta = {
  id: string;
  tipo: string;
  severidade: string;
  cliente_nome: string;
  cod_cliente: string | null;
  cidade: string | null;
  titulo: string;
  descricao: string | null;
  ultima_compra: string | null;
  valor_referencia: number | null;
  linha: string | null;
  status: string;
  motivo_categoria: string | null;
  motivo_detalhe: string | null;
  observacao_rc: string | null;
  plano_acao: string | null;
  respondido_em: string | null;
  mes_referencia: string;
  prazo_resposta?: string | null;
  data_prevista_visita?: string | null;
  resultado_final?: string | null;
  fechado_em?: string | null;
};

const TIPO_ICON: Record<string, any> = {
  sem_compra_mes: Calendar,
  risco_inatividade: AlertTriangle,
   inativo_6m: AlertTriangle,
   inativo_90d: AlertTriangle,
  queda_consumo: TrendingDown,
};

const SEVERIDADE_BADGE: Record<string, "default" | "destructive" | "secondary"> = {
  alta: "destructive",
  media: "default",
  baixa: "secondary",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: any }> = {
  pendente: { label: "Pendente", variant: "destructive", icon: AlertTriangle },
  em_tratativa: { label: "Em tratativa", variant: "default", icon: Clock },
  respondido: { label: "Respondido", variant: "default", icon: CheckCircle2 },
  recuperado: { label: "Recuperado ✅", variant: "secondary", icon: CheckCircle2 },
  perdido: { label: "Perdido", variant: "outline", icon: XCircle },
  escalado: { label: "⚡ Escalado ao gestor", variant: "destructive", icon: AlertTriangle },
};

// Motivos pré-definidos por categoria — RC só clica
const MOTIVOS: Record<string, { value: string; label: string }[]> = {
  comercial: [
    { value: "preco_caro", label: "Preço caro" },
    { value: "prazo_pagamento", label: "Prazo de pagamento ruim" },
    { value: "concorrente_melhor", label: "Concorrente com condição melhor" },
    { value: "sem_orcamento", label: "Cliente sem orçamento" },
  ],
  logistica: [
    { value: "atraso_entrega", label: "Atraso na entrega" },
    { value: "frete_alto", label: "Frete muito alto" },
    { value: "falta_produto", label: "Falta de produto / estoque" },
    { value: "embalagem", label: "Problema de embalagem" },
  ],
  produto: [
    { value: "qualidade", label: "Problema de qualidade" },
    { value: "especificacao", label: "Especificação não atende" },
    { value: "tecnico", label: "Problema técnico de aplicação" },
    { value: "validade", label: "Validade / shelf life curta" },
  ],
  cliente: [
    { value: "parou_producao", label: "Parou de produzir" },
    { value: "mudou_fornecedor", label: "Mudou de fornecedor" },
    { value: "fechou", label: "Fechou / saiu do mercado" },
    { value: "sazonalidade", label: "Sazonalidade do negócio" },
    { value: "estoque_alto", label: "Estoque alto, vai voltar" },
  ],
};

const CATEGORIAS = [
  { value: "comercial", label: "💰 Comercial" },
  { value: "logistica", label: "🚚 Logística" },
  { value: "produto", label: "📦 Produto" },
  { value: "cliente", label: "🏭 Cliente" },
  { value: "outro", label: "✏️ Outro" },
];

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Props = {
  alerta: Alerta;
  onRespondido?: () => void;
  readonly?: boolean;
};

export function AlertaCard({ alerta, onRespondido, readonly }: Props) {
  const [expandido, setExpandido] = useState(alerta.status === "pendente");
  const [categoria, setCategoria] = useState<string>(alerta.motivo_categoria ?? "");
  const [detalhe, setDetalhe] = useState<string>(alerta.motivo_detalhe ?? "");
  const [observacao, setObservacao] = useState<string>(alerta.observacao_rc ?? "");
  const [planoAcao, setPlanoAcao] = useState<string>(alerta.plano_acao ?? "");
  const [dataVisita, setDataVisita] = useState<string>(alerta.data_prevista_visita ?? "");
  const [salvando, setSalvando] = useState(false);

  const Icon = TIPO_ICON[alerta.tipo] ?? AlertTriangle;
  const respondido = alerta.status !== "pendente";
  const fechado = ["recuperado", "perdido"].includes(alerta.status);
  const statusInfo = STATUS_BADGE[alerta.status] ?? STATUS_BADGE.pendente;

  // SLA: dias restantes / atrasado
  const slaInfo = (() => {
    if (!alerta.prazo_resposta || respondido) return null;
    const prazo = new Date(alerta.prazo_resposta + "T23:59:59");
    const hoje = new Date();
    const diff = Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { texto: `Atrasado ${Math.abs(diff)}d`, atrasado: true };
    if (diff === 0) return { texto: "Vence hoje", atrasado: false };
    return { texto: `${diff}d restantes`, atrasado: false };
  })();

  const opcoesDetalhe = categoria && categoria !== "outro" ? MOTIVOS[categoria] : [];

  const responder = async () => {
    if (!categoria) return toast.error("Selecione uma categoria");
    if (categoria !== "outro" && !detalhe) return toast.error("Selecione um motivo");
    if (categoria === "outro" && !observacao.trim()) return toast.error("Descreva o motivo");
    setSalvando(true);
    const { error } = await supabase.from("alertas_rc").update({
      status: "respondido",
      motivo_categoria: categoria,
      motivo_detalhe: categoria === "outro" ? null : detalhe,
      observacao_rc: observacao.trim() || null,
      plano_acao: planoAcao.trim() || null,
      data_prevista_visita: dataVisita || null,
      respondido_em: new Date().toISOString(),
    }).eq("id", alerta.id);
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Resposta registrada");
    onRespondido?.();
  };

  return (
    <Card className={`p-3 ${respondido ? "bg-muted/30" : ""}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${alerta.severidade === "alta" ? "text-destructive" : "text-primary"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{alerta.cliente_nome}</p>
            <Badge variant={SEVERIDADE_BADGE[alerta.severidade]} className="text-[10px]">{alerta.severidade}</Badge>
            <Badge variant={statusInfo.variant} className="text-[10px]">
              <statusInfo.icon className="h-3 w-3 mr-1" />{statusInfo.label}
            </Badge>
            {slaInfo && (
              <Badge variant={slaInfo.atrasado ? "destructive" : "outline"} className="text-[10px]">
                <Clock className="h-3 w-3 mr-1" />{slaInfo.texto}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{alerta.titulo}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
            {alerta.cidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{alerta.cidade}</span>}
            {alerta.ultima_compra && <span>Últ. compra: {format(new Date(alerta.ultima_compra + "T00:00:00"), "dd/MM/yyyy")}</span>}
            {alerta.valor_referencia && <span>Ref.: {fmtBRL(Number(alerta.valor_referencia))}</span>}
            {alerta.linha && <Badge variant="outline" className="text-[10px]">{alerta.linha}</Badge>}
            {alerta.data_prevista_visita && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Visita: {format(new Date(alerta.data_prevista_visita + "T00:00:00"), "dd/MM")}</span>}
          </div>

          {!expandido && !readonly && !fechado && (
            <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs" onClick={() => setExpandido(true)}>
              {respondido ? "Ver / editar resposta" : "Responder"}
            </Button>
          )}

          {expandido && (
            <div className="mt-3 space-y-2">
              {respondido && readonly ? (
                <div className="text-xs space-y-1 bg-accent/30 p-2 rounded">
                  <p><span className="font-semibold">Categoria:</span> {CATEGORIAS.find(c => c.value === alerta.motivo_categoria)?.label ?? alerta.motivo_categoria}</p>
                  {alerta.motivo_detalhe && <p><span className="font-semibold">Motivo:</span> {MOTIVOS[alerta.motivo_categoria!]?.find(m => m.value === alerta.motivo_detalhe)?.label ?? alerta.motivo_detalhe}</p>}
                  {alerta.observacao_rc && <p><span className="font-semibold">Observação:</span> {alerta.observacao_rc}</p>}
                  {alerta.plano_acao && <p><span className="font-semibold">Plano de ação:</span> {alerta.plano_acao}</p>}
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs mb-1 block">Categoria do motivo</Label>
                    <div className="flex flex-wrap gap-1">
                      {CATEGORIAS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => { setCategoria(c.value); setDetalhe(""); }}
                          className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            categoria === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-accent"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {opcoesDetalhe.length > 0 && (
                    <div>
                      <Label className="text-xs mb-1 block">Motivo específico</Label>
                      <div className="flex flex-wrap gap-1">
                        {opcoesDetalhe.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setDetalhe(m.value)}
                            className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                              detalhe === m.value ? "bg-secondary text-secondary-foreground border-secondary" : "bg-background border-input hover:bg-accent"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs mb-1 block">
                      {categoria === "outro" ? "Descreva o motivo *" : "Observação (opcional)"}
                    </Label>
                    <Input
                      placeholder={categoria === "outro" ? "Ex.: cliente trocou de processo produtivo..." : "Detalhes adicionais"}
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value.slice(0, 500))}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Plano de ação (opcional)</Label>
                    <Textarea
                      placeholder="Ex.: visitar dia 15, enviar amostra, alinhar com gerente..."
                      rows={2}
                      value={planoAcao}
                      onChange={(e) => setPlanoAcao(e.target.value.slice(0, 500))}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Data prevista da visita / contato (opcional)</Label>
                    <Input
                      type="date"
                      value={dataVisita}
                      onChange={(e) => setDataVisita(e.target.value)}
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Será sugerida no seu planejamento semanal.</p>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={responder} disabled={salvando} size="sm" className="flex-1">
                      {salvando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {respondido ? "Atualizar" : "Registrar resposta"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpandido(false)}>Fechar</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}