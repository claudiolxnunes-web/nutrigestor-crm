import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle, ClipboardList, Handshake, Search, Lightbulb, CheckCircle2, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ciclo_tutorial_visto";

const ETAPAS = [
  { icon: ClipboardList, titulo: "Planejamento", desc: "Agenda, dados do cliente, objetivo, Plano B" },
  { icon: Handshake, titulo: "Conexão", desc: "Cumprimentar, quebra-gelo, declarar objetivo" },
  { icon: Search, titulo: "Id. Necessidades", desc: "Entender a 'dor', perguntas estratégicas, escuta ativa" },
  { icon: Lightbulb, titulo: "Soluções", desc: "Personalizar benefícios, manejo de objeções" },
  { icon: CheckCircle2, titulo: "Fechamento", desc: "Observar sinal de compra, declarar e anotar o combinado" },
  { icon: RefreshCcw, titulo: "Pós Venda", desc: "Acompanhamento, resultado, cumprir o prometido" },
];

const SPIN = [
  { n: 1, titulo: "Objetivo da Visita", desc: "O que quero que o cliente se comprometa a fazer ao final?" },
  { n: 2, titulo: "Fatos a Descobrir", desc: "Informações que preciso coletar além do que já sei" },
  { n: 3, titulo: "Possíveis Insatisfações", desc: "Problemas que meu produto pode resolver" },
  { n: 4, titulo: "Consequências", desc: "Impacto real dos problemas do cliente" },
  { n: 5, titulo: "Perguntas de Insatisfação", desc: "Como descobrir as dores do cliente" },
  { n: 6, titulo: "Perguntas de Consequências", desc: "Como dimensionar o problema em $ ou resultado" },
  { n: 7, titulo: "Necessidades Potenciais", desc: "O que o cliente provavelmente precisa" },
  { n: 8, titulo: "Perguntas de Valor", desc: "Como mostrar o valor da solução para o cliente" },
];

export function CicloTutorial() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const visto = localStorage.getItem(STORAGE_KEY);
    if (!visto) setAberto(true);
  }, []);

  const toggle = () => {
    const novo = !aberto;
    setAberto(novo);
    if (novo) localStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <Card className="overflow-hidden border-primary/20">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">Como usar — Ciclo de Atendimento + SPIN</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="p-3 pt-0 space-y-4 border-t">
          <div className="pt-3">
            <p className="text-xs font-semibold text-primary mb-2">🎯 Ciclo de Atendimento Excelente</p>
            <p className="text-[11px] text-muted-foreground mb-2">Siga estas 6 etapas em cada visita para maximizar resultados</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ETAPAS.map((e) => (
                <div key={e.titulo} className="rounded-lg border bg-card p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <e.icon className="h-3.5 w-3.5 text-primary" />
                    <p className="text-[11px] font-semibold leading-tight">{e.titulo}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary mb-2">💡 Plano de Visita (Metodologia SPIN)</p>
            <p className="text-[11px] text-muted-foreground mb-2">
              Preencha antes de ir ao campo — clique no ícone <span className="font-medium">📋</span> ao lado de cada cliente na Semana ou Dia.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SPIN.map((s) => (
                <div key={s.n} className="rounded-lg border bg-card p-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-bold text-primary">{s.n}.</span>
                    <p className="text-[11px] font-semibold leading-tight">{s.titulo}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug pl-4">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <Button size="sm" variant="outline" className="w-full" onClick={() => setAberto(false)}>
            Fechar tutorial
          </Button>
        </div>
      )}
    </Card>
  );
}