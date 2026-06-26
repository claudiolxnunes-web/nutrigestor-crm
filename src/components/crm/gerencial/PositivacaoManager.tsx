import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Users, 
  UserCheck, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  Info,
  ChevronRight,
  MessageCircle,
  Calendar,
  CheckCircle2,
  Sparkles,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface PositivacaoStats {
  totalClientes: number;
  ativos: number;
  positivados: number;
  metaPositivacao: number; // ex: 40
  clientesEmRisco: number;
}

export function PositivacaoManager({ stats }: { stats: PositivacaoStats }) {
  const [activeTab, setActiveTab] = useState("estrategia");
  const pctAtivos = (stats.ativos / stats.totalClientes) * 100;
  const pctPositivadosAtivos = (stats.positivados / stats.ativos) * 100;
  
  const isAbaixoMeta = pctPositivadosAtivos < stats.metaPositivacao;

  const etapas = [
    { 
      id: "priorizacao", 
      label: "Priorização", 
      icon: Target, 
      color: "text-blue-500", 
      bg: "bg-blue-50",
      desc: "Identificação de alvos",
      status: "Automático" 
    },
    { 
      id: "contato", 
      label: "Primeiro Contato", 
      icon: MessageCircle, 
      color: "text-emerald-500", 
      bg: "bg-emerald-50",
      desc: "Envio de ofertas",
      status: "WhatsApp/Email" 
    },
    { 
      id: "followup", 
      label: "Follow-up", 
      icon: Calendar, 
      color: "text-amber-500", 
      bg: "bg-amber-50",
      desc: "Retorno planejado",
      status: "Lembretes" 
    },
    { 
      id: "fechamento", 
      label: "Fechamento", 
      icon: CheckCircle2, 
      color: "text-purple-500", 
      bg: "bg-purple-50",
      desc: "Conversão final",
      status: "Meta 40%" 
    }
  ];

  const handleStartCampaign = () => {
    toast.success("Programa de Positivação Automática iniciado!", {
      description: "A IA está processando os clientes em risco para gerar os primeiros contatos."
    });
  };

  return (
    <div className="space-y-6">
      {/* Header com Resumo Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Carteira</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalClientes}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Clientes cadastrados</div>
        </Card>

        <Card className="p-4 border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Ativos (6 meses)</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.ativos}</div>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-emerald-50 text-emerald-600 font-bold">
              {pctAtivos.toFixed(1)}% da base
            </Badge>
          </div>
        </Card>

        <Card className={cn(
          "p-4 border-slate-100 shadow-sm",
          isAbaixoMeta ? "bg-rose-50/30 border-rose-100" : "bg-emerald-50/30 border-emerald-100"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Positivação Real</span>
            <Target className={cn("w-4 h-4", isAbaixoMeta ? "text-rose-500" : "text-emerald-500")} />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.positivados}</div>
          <div className="flex items-center gap-1 mt-1">
            <span className={cn(
              "text-[10px] font-bold",
              isAbaixoMeta ? "text-rose-600" : "text-emerald-600"
            )}>
              {pctPositivadosAtivos.toFixed(1)}% dos ativos
            </span>
            <span className="text-[9px] text-muted-foreground">(Meta: {stats.metaPositivacao}%)</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Em Risco</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.clientesEmRisco}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Próximos da inativação</div>
        </Card>
      </div>

      {/* Painel de Programa de Positivação */}
      <Card className="p-6 border-primary/10 overflow-hidden relative shadow-premium bg-white">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Sparkles className="w-48 h-48 text-primary" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-white hover:bg-primary uppercase text-[9px] font-black tracking-widest px-2 h-5">Novo</Badge>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Programa de Positivação Automática
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">Ciclo de vida inteligente para reduzir inativação e bater meta de 40%</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleStartCampaign} className="h-9 px-6 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Iniciar Novo Ciclo
              </Button>
            </div>
          </div>

          <Tabs defaultValue="estrategia" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="bg-slate-100 p-1 mb-8 h-10 w-full md:w-auto">
              <TabsTrigger value="estrategia" className="text-[10px] font-black uppercase tracking-wider px-6 h-8">Estratégia do Mês</TabsTrigger>
              <TabsTrigger value="etapas" className="text-[10px] font-black uppercase tracking-wider px-6 h-8">Fluxo Automático</TabsTrigger>
              <TabsTrigger value="representantes" className="text-[10px] font-black uppercase tracking-wider px-6 h-8">Metas por RC</TabsTrigger>
            </TabsList>

            <TabsContent value="estrategia" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-muted-foreground uppercase">Progresso Consolidado da Regional</span>
                      <span className={cn(isAbaixoMeta ? "text-rose-600" : "text-emerald-600")}>
                        {pctPositivadosAtivos.toFixed(1)}% / {stats.metaPositivacao}%
                      </span>
                    </div>
                    <Progress value={(pctPositivadosAtivos / stats.metaPositivacao) * 100} className="h-3 rounded-full bg-slate-100" />
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                      Faltam <strong>{Math.max(0, Math.ceil((stats.metaPositivacao/100 * stats.ativos) - stats.positivados))} clientes</strong> para atingir a meta de 40% este mês.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 border-slate-100 bg-white shadow-sm hover:border-primary/20 transition-colors cursor-pointer group">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Público Alvo IA</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-black">{stats.clientesEmRisco}</span>
                        <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600 bg-amber-50">Em Risco</Badge>
                      </div>
                      <div className="mt-3 flex items-center text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver Lista <ChevronRight className="w-3 h-3 ml-1" />
                      </div>
                    </Card>
                    <Card className="p-4 border-slate-100 bg-white shadow-sm hover:border-primary/20 transition-colors cursor-pointer group">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Potencial Recuperação</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-black">R$ 142k</span>
                        <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600 bg-blue-50">+12% Fat</Badge>
                      </div>
                      <div className="mt-3 flex items-center text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver Detalhes <ChevronRight className="w-3 h-3 ml-1" />
                      </div>
                    </Card>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 rounded-[24px] p-6 border border-slate-100 dark:border-white/10 relative overflow-hidden">
                   <div className="absolute -right-10 -bottom-10 opacity-[0.05] rotate-12">
                     <TrendingUp className="w-40 h-40 text-primary" />
                   </div>
                  <h4 className="text-xs font-black uppercase text-slate-500 mb-5 tracking-widest flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Recomendações Automáticas
                  </h4>
                  <ul className="space-y-4 relative z-10">
                    <li className="flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-slate-900">Alerta de Inativação em Lote</p>
                        <p className="text-[10px] text-muted-foreground leading-snug"><strong>80 clientes</strong> inativam em 15 dias. Prioridade máxima na etapa de "Contato".</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Target className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-slate-900">Reativação com Histórico</p>
                        <p className="text-[10px] text-muted-foreground leading-snug"><strong>32%</strong> da base inativa tem alto potencial de compra. IA sugere campanha de "Mix de Boas-vindas".</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-bold text-slate-900">Impacto na Meta</p>
                        <p className="text-[10px] text-muted-foreground leading-snug">Aumentar positivação para 40% gera aprox. <strong>R$ 85k</strong> extras neste ciclo.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="etapas" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {etapas.map((etapa, idx) => (
                  <div key={etapa.id} className="relative group">
                    <Card className="p-5 h-full border-slate-100 hover:border-primary/30 transition-all hover:shadow-md cursor-default">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", etapa.bg)}>
                        <etapa.icon className={cn("w-6 h-6", etapa.color)} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-900">{etapa.label}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{etapa.desc}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50">
                        <Badge variant="secondary" className="text-[9px] font-bold h-5 bg-slate-100 text-slate-600">{etapa.status}</Badge>
                      </div>
                    </Card>
                    {idx < etapas.length - 1 && (
                      <div className="hidden md:flex absolute top-1/2 -right-2 z-20 translate-y-[-50%] w-4 h-4 bg-white rounded-full border border-slate-100 items-center justify-center text-slate-300">
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                <div className="p-2.5 bg-white rounded-xl shadow-sm">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-primary">Automação Ativa</h4>
                  <p className="text-[10px] text-muted-foreground">A IA gera automaticamente mensagens personalizadas de "Priorização" e "Contato" no WhatsApp dos representantes.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="representantes" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden shadow-sm">
                 <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                   <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Metas por Representante (Meta Regional: 40%)</h4>
                   <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-wider">Ver Ranking Completo</Button>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead className="bg-slate-50/50 border-b border-slate-100">
                       <tr>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Representante</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Ativos</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Positivados</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Progresso</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Status Campanha</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {[
                         { nome: "João Silva", ativos: 42, posit: 15, status: "Acompanhando" },
                         { nome: "Maria Souza", ativos: 38, posit: 18, status: "Priorizando" },
                         { nome: "Pedro Alves", ativos: 45, posit: 12, status: "Crítico" },
                         { nome: "Ana Costa", ativos: 35, posit: 22, status: "Meta Batida" }
                       ].map((rc, i) => (
                         <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                 {rc.nome.split(' ').map(n => n[0]).join('')}
                               </div>
                               <span className="text-xs font-bold text-slate-900">{rc.nome}</span>
                             </div>
                           </td>
                           <td className="px-6 py-4 text-xs text-slate-600 font-medium">{rc.ativos}</td>
                           <td className="px-6 py-4 text-xs text-slate-600 font-medium">{rc.posit}</td>
                           <td className="px-6 py-4">
                             <div className="w-32 space-y-1.5">
                               <div className="flex justify-between text-[10px] font-bold">
                                 <span>{((rc.posit / rc.ativos) * 100).toFixed(0)}%</span>
                               </div>
                               <Progress value={(rc.posit / rc.ativos) * 250} className="h-1.5" />
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <Badge 
                               variant="secondary" 
                               className={cn(
                                 "text-[9px] font-black uppercase tracking-widest px-2",
                                 rc.status === 'Meta Batida' ? "bg-emerald-50 text-emerald-600" : 
                                 rc.status === 'Crítico' ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                               )}
                             >
                               {rc.status}
                             </Badge>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
