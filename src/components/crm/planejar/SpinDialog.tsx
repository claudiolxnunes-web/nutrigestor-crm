import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId?: string;
  planejamentoId: string;
  clienteNome: string;
  clienteId?: string | null;
  codRc?: string | null;
  dataVisita?: string | null;
  onSaved?: () => void;
};

const CAMPOS: { key: string; numero: number; titulo: string; ajuda: string; placeholder: string }[] = [
  { key: "objetivo_visita", numero: 1, titulo: "Objetivo da Visita", ajuda: "O que quero que o cliente se comprometa a fazer ao final?", placeholder: "Ex.: fechar pedido teste de 200 sacos da nova linha" },
  { key: "fatos_descobrir", numero: 2, titulo: "Fatos a Descobrir", ajuda: "Informações que preciso coletar além do que já sei", placeholder: "Ex.: volume mensal real, fornecedor atual, prazo de pagamento praticado" },
  { key: "possiveis_insatisfacoes", numero: 3, titulo: "Possíveis Insatisfações", ajuda: "Problemas que meu produto pode resolver", placeholder: "Ex.: alta conversão alimentar, mortalidade acima da média" },
  { key: "consequencias", numero: 4, titulo: "Consequências", ajuda: "Impacto real dos problemas do cliente", placeholder: "Ex.: perda de R$ X/mês em ração, atraso no abate" },
  { key: "perguntas_insatisfacao", numero: 5, titulo: "Perguntas de Insatisfação", ajuda: "Como descobrir as dores do cliente", placeholder: "Ex.: como está sua conversão hoje? Tem batido a meta?" },
  { key: "perguntas_consequencias", numero: 6, titulo: "Perguntas de Consequências", ajuda: "Como dimensionar o problema em $ ou resultado", placeholder: "Ex.: quanto isso representa por lote? E no ano?" },
  { key: "necessidades_potenciais", numero: 7, titulo: "Necessidades Potenciais", ajuda: "O que o cliente provavelmente precisa", placeholder: "Ex.: ração de melhor digestibilidade, suporte técnico mais próximo" },
  { key: "perguntas_valor", numero: 8, titulo: "Perguntas de Valor", ajuda: "Como mostrar o valor da solução para o cliente", placeholder: "Ex.: se conseguíssemos reduzir 5% da conversão, quanto representaria?" },
];

export function SpinDialog({ open, onOpenChange, userId, planejamentoId, clienteNome, clienteId, codRc, dataVisita, onSaved }: Props) {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !planejamentoId) return;
    setLoading(true);
    supabase.from("planos_visita_spin").select("*").eq("planejamento_id", planejamentoId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRegistroId(data.id);
          const novo: Record<string, string> = {};
          CAMPOS.forEach((c) => { novo[c.key] = (data as any)[c.key] ?? ""; });
          setForm(novo);
        } else {
          setRegistroId(null);
          const vazio: Record<string, string> = {};
          CAMPOS.forEach((c) => { vazio[c.key] = ""; });
          setForm(vazio);
        }
        setLoading(false);
      });
  }, [open, planejamentoId]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v.slice(0, 2000) }));

  const salvar = async () => {
    if (!userId || !orgId) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      organizacao_id: orgId,
      planejamento_id: planejamentoId,
      cliente_id: clienteId ?? null,
      cliente_nome: clienteNome,
      cod_rc: codRc ?? null,
      data_visita: dataVisita ?? null,
      ...form,
      status: "preenchido",
    };
    const { error } = registroId
      ? await supabase.from("planos_visita_spin").update(payload).eq("id", registroId)
      : await supabase.from("planos_visita_spin").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Plano SPIN salvo");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plano de Visita — Metodologia SPIN</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{clienteNome}</span> — preencha antes de ir ao campo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {CAMPOS.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-primary w-5">{c.numero}.</span>
                  <Label className="text-sm font-semibold">{c.titulo}</Label>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7">{c.ajuda}</p>
                <Textarea
                  value={form[c.key] ?? ""}
                  onChange={(e) => set(c.key, e.target.value)}
                  placeholder={c.placeholder}
                  rows={2}
                  className="ml-7 w-[calc(100%-1.75rem)]"
                />
              </div>
            ))}

            <Button onClick={salvar} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar plano SPIN
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}