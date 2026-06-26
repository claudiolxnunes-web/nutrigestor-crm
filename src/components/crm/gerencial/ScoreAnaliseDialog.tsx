import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, AlertCircle, TrendingUp, Target, Activity, Repeat } from "lucide-react";

 import { fmtBRL, fmtPct } from "@/utils/crm/formatters";

export type ScoreAnaliseData = {
  nome: string;
  cod_rc: string | null;
  fatRC: number;
  abertoRC: number;
  metaRC: number;
  atingPct: number;
  planTotal: number;
  planFeitos: number;
  cumprimentoPct: number;
  totalInter: number;
  atividadePct: number;
  conversaoPct: number;
  score: number;
  nivel: "ok" | "atencao" | "risco";
  acoesRC: number;
  diasUteisRest: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ScoreAnaliseData | null;
};

const Componente = ({
  icon: Icon,
  titulo,
  peso,
  valor,
  pontos,
  detalhe,
  contribuicao,
}: {
  icon: any;
  titulo: string;
  peso: number;
  valor: string;
  pontos: number;
  detalhe: string;
  contribuicao: number;
}) => {
  const cor = contribuicao / peso >= 0.85 ? "text-primary" : contribuicao / peso >= 0.5 ? "text-foreground" : "text-destructive";
  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">{titulo}</div>
            <div className="text-[11px] text-muted-foreground">Peso {peso} pts · {detalhe}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-base font-semibold ${cor}`}>{valor}</div>
          <div className="text-[11px] text-muted-foreground">{pontos.toFixed(1)} / {peso} pts</div>
        </div>
      </div>
      <Progress value={Math.min(100, (contribuicao / peso) * 100)} className="h-1.5" />
    </div>
  );
};

export const ScoreAnaliseDialog = ({ open, onOpenChange, data }: Props) => {
  if (!data) return null;
  const projAting = data.metaRC > 0 ? (data.fatRC + data.abertoRC) / data.metaRC : data.atingPct;
   const metaScore = data.metaRC > 0 ? Math.min(1.5, projAting) : 0.5;
  const ptsMeta = metaScore * 40;
  const ptsPlano = data.cumprimentoPct * 25;
   const ptsAtiv = data.atividadePct * 20;
   const ptsConv = data.conversaoPct * 15;

   // Normaliza pts para não passar do peso máximo na exibição individual, 
   // exceto meta que pode ter bônus.
   const ptsPlanoDisp = Math.min(25, ptsPlano);
   const ptsAtivDisp = Math.min(20, ptsAtiv);
   const ptsConvDisp = Math.min(15, ptsConv);

  const motivos: { tipo: "alerta" | "ok"; texto: string }[] = [];
  if (data.metaRC > 0 && projAting >= 1) {
    motivos.push({ tipo: "ok", texto: `Meta atingida na projeção (${fmtPct(projAting)}). Não classifica como risco mesmo com outros indicadores baixos.` });
  } else if (data.metaRC > 0 && projAting < 0.7) {
    motivos.push({ tipo: "alerta", texto: `Projeção em apenas ${fmtPct(projAting)} da meta — peso de 40 pontos pesa muito no score.` });
  }
  if (data.planTotal === 0) {
    motivos.push({ tipo: "alerta", texto: "Sem plano semanal cadastrado — perde os 25 pontos de cumprimento de plano." });
  } else if (data.cumprimentoPct < 0.5) {
    motivos.push({ tipo: "alerta", texto: `Cumpriu ${data.planFeitos} de ${data.planTotal} visitas planejadas (${fmtPct(data.cumprimentoPct)}).` });
  }
  if (data.totalInter < 10) {
    motivos.push({ tipo: "alerta", texto: `Apenas ${data.totalInter} atividades registradas no mês (referência 30/mês = 100%).` });
  }
  if (data.totalInter > 0 && data.conversaoPct < 0.3) {
    motivos.push({ tipo: "alerta", texto: `Conversão baixa de orçamento → venda (${fmtPct(data.conversaoPct)}).` });
  }
  if (motivos.length === 0) {
    motivos.push({ tipo: "ok", texto: "Todos os indicadores estão em nível adequado." });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
        <DialogHeader className="p-6 md:p-8 pb-0 text-left">
          <div className="flex items-center justify-between gap-4 mb-2">
            <DialogTitle className="text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">Análise de Score</DialogTitle>
            <Badge
              variant={data.nivel === "risco" ? "destructive" : data.nivel === "atencao" ? "default" : "secondary"}
              className="text-[9px] font-black uppercase tracking-tighter h-5"
            >
              {data.nivel === "risco" ? "Risco" : data.nivel === "atencao" ? "Atenção" : "OK"}
            </Badge>
          </div>
          <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            {data.nome} • Cód. RC: <span className="font-mono">{data.cod_rc ?? "—"}</span><br />
            Score: <span className="text-slate-900 dark:text-white">{data.score}/100</span> • {data.diasUteisRest} dias restantes
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto overflow-x-hidden border-t border-slate-100 dark:border-white/5 mt-4">
          <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground mb-1">Score total</div>
            <div className="flex items-center gap-3">
              <Progress value={data.score} className="h-3 flex-1" />
              <span className="font-mono font-semibold">{data.score}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Faixas: ≥ 70 OK · 50–69 Atenção · &lt; 50 Risco. Quem já bateu a meta nunca cai em Risco (vira no máximo Atenção).
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Componente
              icon={Target}
              titulo="Meta (projeção)"
              peso={40}
              valor={data.metaRC > 0 ? fmtPct(projAting) : "Sem meta"}
              pontos={ptsMeta}
              contribuicao={ptsMeta}
              detalhe={
                data.metaRC > 0
                  ? `${fmtBRL(data.fatRC)} + ${fmtBRL(data.abertoRC)} aberto / ${fmtBRL(data.metaRC)}`
                  : "Sem meta cadastrada — usa 50%"
              }
            />
            <Componente
               icon={TrendingUp}
               titulo="Cumprimento do plano semanal"
               peso={25}
               valor={data.planTotal > 0 ? `${data.planFeitos}/${data.planTotal}` : "Sem plano"}
               pontos={ptsPlanoDisp}
               contribuicao={ptsPlanoDisp}
               detalhe={data.planTotal > 0 ? `${fmtPct(data.cumprimentoPct)} cumprido` : "Nenhum cliente planejado"}
             />
             <Componente
               icon={Activity}
               titulo="Atividades no mês"
               peso={20}
               valor={`${data.totalInter}`}
               pontos={ptsAtivDisp}
               contribuicao={ptsAtivDisp}
               detalhe="Referência: 30 interações/mês = 100%"
             />
             <Componente
               icon={Repeat}
               titulo="Conversão orçamento → venda"
               peso={15}
               valor={fmtPct(data.conversaoPct)}
               pontos={ptsConvDisp}
               contribuicao={ptsConvDisp}
               detalhe={data.totalInter === 0 ? "Sem atividades para medir" : "vendidos / (orçamento+vendido+perdido)"}
             />
          </div>

          <div className="rounded-xl border p-3 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Por que este nível?
            </h4>
            <ul className="space-y-1.5">
              {motivos.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {m.tipo === "alerta" ? (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  )}
                  <span className="text-muted-foreground">{m.texto}</span>
                </li>
              ))}
            </ul>
          </div>

          {data.acoesRC > 0 && (
            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              Existem <span className="font-semibold text-foreground">{data.acoesRC}</span> ação(ões) abertas do gestor para este RC.
            </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};