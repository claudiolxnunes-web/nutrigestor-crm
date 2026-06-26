import { useState } from "react";
import { Trash2, AlertTriangle, Loader2, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

type Tabela =
  | "vendas"
  | "pedidos_aberto"
  | "clientes"
  | "produtos"
  | "representantes"
  | "metas"
  | "interacoes"
  | "dias_trabalho"
  | "planejamento_semanal"
  | "planejamento_gerencial"
  | "planos_visita_spin"
  | "objetivos_smart"
  | "acoes_gestor"
  | "alertas_rc";
type EtapaStatus = "pendente" | "em_andamento" | "ok" | "erro";
interface EtapaProgresso {
  tabela: Tabela;
  label: string;
  status: EtapaStatus;
  registros?: number;
  erro?: string;
}

const OPCOES: { key: Tabela; label: string; descricao: string }[] = [
  { key: "vendas", label: "Vendas (Dinâmica)", descricao: "Apaga todas as notas/faturamento importados." },
  { key: "pedidos_aberto", label: "Pedidos em Aberto", descricao: "Apaga toda a carteira de pedidos em aberto." },
  { key: "interacoes", label: "Visitas / Interações", descricao: "Apaga histórico de visitas e interações." },
  { key: "dias_trabalho", label: "Dias de Trabalho", descricao: "Apaga registros de dias planejados/trabalhados." },
  { key: "planejamento_semanal", label: "Planejamento Semanal", descricao: "Apaga planejamentos semanais." },
  { key: "planejamento_gerencial", label: "Planejamento Gerencial", descricao: "Apaga planejamentos gerenciais." },
  { key: "planos_visita_spin", label: "Planos SPIN", descricao: "Apaga planos de visita SPIN." },
  { key: "objetivos_smart", label: "Objetivos SMART", descricao: "Apaga objetivos SMART." },
  { key: "acoes_gestor", label: "Ações do Gestor", descricao: "Apaga ações registradas pelo gestor." },
  { key: "alertas_rc", label: "Alertas dos RCs", descricao: "Apaga alertas gerados para RCs." },
  { key: "clientes", label: "Clientes", descricao: "Apaga toda a base de clientes." },
  { key: "produtos", label: "Produtos", descricao: "Apaga todo o catálogo de produtos." },
  { key: "representantes", label: "Representantes", descricao: "Apaga RCs cadastrados (mantém usuários auth)." },
  { key: "metas", label: "Metas", descricao: "Apaga metas mensais por RC/linha." },
];

const LimparDados = () => {
  const { orgId } = useOrg();
  const { isGestor, loading: roleLoading } = useRole();
  const [open, setOpen] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<Tabela>>(new Set());
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [etapas, setEtapas] = useState<EtapaProgresso[]>([]);
  const [etapaAtual, setEtapaAtual] = useState(0);

  if (roleLoading || !isGestor) return null;

  const toggle = (k: Tabela) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const reset = () => {
    setSelecionadas(new Set());
    setConfirmacao("");
    setEtapas([]);
    setEtapaAtual(0);
  };

  const podeLimpar = selecionadas.size > 0 && confirmacao.trim().toUpperCase() === "LIMPAR";

  const selecionarTudo = () => {
    setSelecionadas(new Set(OPCOES.map((o) => o.key)));
  };

  const limpar = async () => {
    if (!orgId || !podeLimpar) return;
    setLoading(true);

    // Ordena conforme a OPCOES para feedback consistente
    const lista = OPCOES.filter((o) => selecionadas.has(o.key)).map<EtapaProgresso>((o) => ({
      tabela: o.key,
      label: o.label,
      status: "pendente",
    }));
    setEtapas(lista);
    setEtapaAtual(0);

    const sucessos: string[] = [];
    const erros: string[] = [];

    for (let i = 0; i < lista.length; i++) {
      setEtapaAtual(i);
      setEtapas((prev) => prev.map((e, idx) => (idx === i ? { ...e, status: "em_andamento" } : e)));

      // Conta antes de apagar
      const { count } = await supabase
        .from(lista[i].tabela)
        .select("*", { count: "exact", head: true })
        .eq("organizacao_id", orgId);

      const { error } = await supabase.from(lista[i].tabela).delete().eq("organizacao_id", orgId);

      if (error) {
        erros.push(`${lista[i].label}: ${error.message}`);
        setEtapas((prev) =>
          prev.map((e, idx) => (idx === i ? { ...e, status: "erro", erro: error.message } : e)),
        );
      } else {
        sucessos.push(lista[i].label);
        setEtapas((prev) =>
          prev.map((e, idx) =>
            idx === i ? { ...e, status: "ok", registros: count ?? 0 } : e,
          ),
        );
      }
    }

    setEtapaAtual(lista.length);
    setLoading(false);

    if (sucessos.length) {
      toast.success(`Dados apagados: ${sucessos.join(", ")}`);
      window.dispatchEvent(new Event("importacoes:refresh-all"));
    }
    if (erros.length) toast.error(erros.join(" | "));
  };

  const totalEtapas = etapas.length;
  const concluidas = etapas.filter((e) => e.status === "ok" || e.status === "erro").length;
  const progresso = totalEtapas > 0 ? Math.round((concluidas / totalEtapas) * 100) : 0;
  const finalizou = totalEtapas > 0 && concluidas === totalEtapas;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Limpar dados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Limpar dados da organização
          </DialogTitle>
          <DialogDescription>
            Esta ação <strong>não pode ser desfeita</strong>. Selecione o que deseja apagar e digite{" "}
            <strong>LIMPAR</strong> para confirmar.
          </DialogDescription>
        </DialogHeader>

        {etapas.length === 0 && (
          <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selecionadas.size} de {OPCOES.length} selecionadas
            </span>
            <Button type="button" variant="outline" size="sm" onClick={selecionarTudo}>
              Selecionar tudo
            </Button>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {OPCOES.map((op) => (
            <label
              key={op.key}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selecionadas.has(op.key)}
                onCheckedChange={() => toggle(op.key)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="font-medium text-sm">{op.label}</div>
                <div className="text-xs text-muted-foreground">{op.descricao}</div>
              </div>
            </label>
          ))}
          </div>
          </div>
        )}

        {etapas.length > 0 && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {loading
                    ? `Apagando ${concluidas + 1} de ${totalEtapas}...`
                    : finalizou
                      ? "Concluído"
                      : `${concluidas} de ${totalEtapas}`}
                </span>
                <span className="font-medium tabular-nums">{progresso}%</span>
              </div>
              <Progress value={progresso} />
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {etapas.map((e, idx) => (
                <div
                  key={e.tabela}
                  className="flex items-start gap-2 p-2 rounded-md border border-border bg-muted/30 text-sm"
                >
                  {e.status === "pendente" && (
                    <CircleDashed className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  )}
                  {e.status === "em_andamento" && (
                    <Loader2 className="h-4 w-4 mt-0.5 text-primary animate-spin" />
                  )}
                  {e.status === "ok" && <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" />}
                  {e.status === "erro" && <XCircle className="h-4 w-4 mt-0.5 text-destructive" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{e.label}</div>
                    {e.status === "ok" && (
                      <div className="text-xs text-muted-foreground">
                        {e.registros ?? 0} registro(s) apagado(s)
                      </div>
                    )}
                    {e.status === "em_andamento" && (
                      <div className="text-xs text-muted-foreground">Apagando...</div>
                    )}
                    {e.status === "pendente" && (
                      <div className="text-xs text-muted-foreground">Aguardando...</div>
                    )}
                    {e.status === "erro" && (
                      <div className="text-xs text-destructive break-words">{e.erro}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {etapas.length === 0 && (
          <div className="space-y-2">
            <Label htmlFor="confirma-limpar" className="text-sm">
              Digite <span className="font-mono font-bold text-destructive">LIMPAR</span> para confirmar:
            </Label>
            <Input
              id="confirma-limpar"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="LIMPAR"
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          {etapas.length === 0 && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={limpar}
                disabled={!podeLimpar || loading}
                className="gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Apagar selecionados
              </Button>
            </>
          )}
          {etapas.length > 0 && (
            <Button
              variant={finalizou ? "default" : "outline"}
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={loading}
            >
              {finalizou ? "Fechar" : "Aguarde..."}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LimparDados;