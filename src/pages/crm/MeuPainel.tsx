import { useEffect, useMemo, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Lightbulb, Users2, UserMinus, History, TrendingUp, WalletCards, Target, Info, Sparkles, Brain, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AlertasRC } from "@/components/crm/alertas/AlertasRC";
import { useRole } from "@/hooks/useRole";
import { useOrg } from "@/hooks/useOrg";
import { MesMultiSelect } from "@/components/crm/MesMultiSelect";
import { crmService } from "@/services/crmService";
import { useMetas } from "@/hooks/crm/useMetas";
import { Seo } from "@/components/Seo";
import { useCrmKpis } from "@/hooks/crm/useCrmKpis";
import { fmtBRL, fmtPct, fmtNum } from "@/utils/crm/formatters";
import { Venda, Meta, PedidoAberto, Cliente } from "@/types/crm";
import { ClientesInativosCard } from "@/components/crm/gerencial/ClientesInativosCard";
import { PlanejamentoIA } from "@/components/crm/gerencial/PlanejamentoIA";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

import { motion } from "framer-motion";

const currentMonth = () => {

  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const MeuPainel = () => {
  const navigate = useNavigate();
  const { isGestor, isRC, representativeCode, gestorCode, loading: roleLoading } = useRole();
  const { orgId } = useOrg();
  const [mesesSel, setMesesSel] = useState<string[]>([currentMonth()]);
  const [buscaNF, setBuscaNF] = useState("");
  const [paginaNF, setPaginaNF] = useState(1);
  const PAGE_SIZE_NF = 10;

  const { data, isLoading: loading, refetch: load } = useMetas(orgId);

  const handleRefresh = useCallback(() => {
    load();
  }, [load]);

  const gerarAlertasInatividade = async () => {
    const { error } = await supabase.rpc('gerar_alertas_inatividade_automatica');
    if (error) {
      console.error("Erro ao gerar alertas:", error);
    } else {
      load(); 
    }
  };

  useEffect(() => {
    if (orgId && !loading) {
      gerarAlertasInatividade();
    }
  }, [orgId, loading]);

  const vendas = useMemo(() => data?.vendasAgg ?? [] as Venda[], [data]);
  const metas = useMemo(() => data?.metas ?? [] as Meta[], [data]);
  const pedidosAberto = useMemo(() => data?.pedidosAberto ?? [] as PedidoAberto[], [data]);
  const clientes = useMemo(() => data?.clientes ?? [] as Cliente[], [data]);

  const mesesSelSet = useMemo(() => new Set(mesesSel), [mesesSel]);
  const vendasMes = useMemo(
    () => vendas.filter((v) => v.mes_ano && mesesSelSet.has(v.mes_ano)),
    [vendas, mesesSelSet]
  );
  const metasMes = useMemo(
    () => metas.filter((m) => mesesSelSet.has(m.mes_ano)),
    [metas, mesesSelSet]
  );

  const isMesCorrente = mesesSel.includes(currentMonth());
  const pedidosVigentes = useMemo(() => {
    if (pedidosAberto.length === 0) return [] as PedidoAberto[];
    const ultimo = pedidosAberto.reduce((max, p) => (p.data_snapshot && p.data_snapshot > max ? p.data_snapshot : max), "");
    return ultimo ? pedidosAberto.filter((p) => p.data_snapshot === ultimo) : pedidosAberto;
  }, [pedidosAberto]);

  const kpis = useCrmKpis({
    vendas: vendasMes,
    metas: metasMes,
    pedidosAberto: pedidosVigentes,
    mesCorrente: currentMonth()
  });

  const analiseCarteira = useMemo(() => {
    const positivadosIds = new Set(vendasMes.map(v => v.cod_cliente).filter(Boolean));
    const positivadosNomes = new Set(vendasMes.map(v => v.nome_cliente).filter(Boolean));
    pedidosVigentes.forEach(p => {
      if (p.cod_cliente) positivadosIds.add(String(p.cod_cliente));
      if (p.cliente_nome) positivadosNomes.add(p.cliente_nome);
    });

    const semAtendimento = clientes.filter(c => {
      const temVendaOrPedido = (c.codigo && positivadosIds.has(c.codigo)) || 
                               (c.razao_social && positivadosNomes.has(c.razao_social));
      return !temVendaOrPedido;
    });

    const maiorTempoSemPositivacao = [...clientes]
      .filter(c => c.ultima_compra)
      .sort((a, b) => (a.ultima_compra || "").localeCompare(b.ultima_compra || ""))
      .slice(0, 10);

    return {
      total: clientes.length,
      positivados: clientes.length - semAtendimento.length,
      semAtendimento: semAtendimento,
      maiorTempoSemPositivacao
    };
  }, [clientes, vendasMes, pedidosVigentes]);

  const porLinha = useMemo(() => {
    const map = new Map<string, { linha: string; fat: number; vol: number; meta: number; aberto: number }>();
    vendasMes.forEach((v) => {
      const k = v.solucao || v.subsolucao || v.linha || "—";
      const cur = map.get(k) ?? { linha: k, fat: 0, vol: 0, meta: 0, aberto: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      map.set(k, cur);
    });
    metasMes.forEach((m) => {
      const cur = map.get(m.linha) ?? { linha: m.linha, fat: 0, vol: 0, meta: 0, aberto: 0 };
      cur.meta += Number(m.meta_faturamento) || 0;
      map.set(m.linha, cur);
    });

    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const hierarquia = {
      "NUTRICAO RUMINANTES": new Set([
        "PREMIX E OUTROS", 
        "GORDURAS PROPRIAS", 
        "SAL MINERAL", 
        "LACTEOS", 
        "GRAO INTEIRO",
        "BOVINOS DE CORTE",
        "BOVINOS DE LEITE",
        "LEITE",
        "CORTE",
        "OUTROS RUMINANTES",
        "OVINOS",
        "CAPRINOS",
        "BUBALINOS"
      ]),
    };

    map.forEach((cur, key) => {
      const k = norm(key);
      Object.entries(hierarquia).forEach(([paiNome, filhos]) => {
        if (filhos.has(k)) {
          const pai = map.get(paiNome) ?? { linha: paiNome, fat: 0, vol: 0, meta: 0, aberto: 0 };
          pai.fat += cur.fat;
          pai.vol += cur.vol;
          pai.meta += cur.meta;
          pai.aberto += cur.aberto;
          map.set(paiNome, pai);
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.fat - a.fat);
  }, [vendasMes, metasMes]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    vendas.forEach((v) => v.mes_ano && set.add(v.mes_ano));
    metas.forEach((m) => m.mes_ano && set.add(m.mes_ano));
    return Array.from(set).sort().reverse();
  }, [vendas, metas]);

  return (
    <div className="space-y-6 pb-20">
      <Seo title="Meu Painel" description="Resumo de performance Agro_RC" path="/meu-painel" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader title="Meu Painel" subtitle="Visão 360° da sua performance comercial" />
        <div className="flex items-center gap-3">
          <MesMultiSelect available={mesesDisponiveis} value={mesesSel} onChange={setMesesSel} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizado em tempo real</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-card p-4 rounded-[24px] border border-primary/20 shadow-sm flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold leading-tight">Planejamento da Semana</h4>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Inteligência Artificial</p>
          </div>
        </div>
        <Button 
          onClick={() => navigate("/planejamento-ia")}
          variant="default" 
          size="sm"
          className="h-9 px-5 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
        >
          Ver Insights <ArrowRight className="ml-2 h-3 w-3" />
        </Button>
      </motion.div>


      <BentoGrid>

        <BentoCard title="Faturamento" subtitle="Realizado" icon={<TrendingUp className="h-4 w-4" />} className="md:col-span-2 lg:col-span-2">
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">{fmtBRL(kpis.fat)}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("text-[10px] font-bold", kpis.atingFat >= 1 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white")}>
                  {fmtPct(kpis.atingFat)} da Meta
                </Badge>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">META: {fmtBRL(kpis.metaFat)}</span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-1000", kpis.atingFat >= 1 ? "bg-emerald-500" : "bg-primary")} 
                style={{ width: `${Math.min(100, kpis.atingFat * 100)}%` }} 
              />
            </div>
          </div>
        </BentoCard>

        <BentoCard title="Projeção" subtitle="Faturamento + Carteira" icon={<Sparkles className="h-4 w-4 text-amber-500" />} className="md:col-span-2 lg:col-span-2">
          <div className="space-y-4">
            <div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">{fmtBRL(kpis.projFat)}</div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-tighter">Tendência de Fechamento</p>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-tight">
              <span className="text-slate-500">Atingimento Previsto:</span>
              <span className={cn(kpis.projAtingFat >= 1 ? "text-emerald-500" : "text-primary")}>{fmtPct(kpis.projAtingFat)}</span>
            </div>
          </div>
        </BentoCard>

        <BentoCard title="Saúde da Carteira" subtitle="Monitoramento" icon={<Users2 className="h-4 w-4" />} className="md:col-span-2 lg:col-span-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{analiseCarteira.positivados}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-black">Positivados</p>
              </div>
              <div>
                <div className="text-lg font-black text-rose-500">{analiseCarteira.semAtendimento.length}</div>
                <p className="text-[9px] text-muted-foreground uppercase font-black">Inativos</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-50 dark:border-white/5">
              <p className="text-[10px] text-muted-foreground leading-tight">
                {fmtPct(analiseCarteira.positivados / (analiseCarteira.total || 1))} de cobertura da carteira atual.
              </p>
            </div>
          </div>
        </BentoCard>

        <BentoCard title="Ações Prioritárias" subtitle="Alertas" icon={<Lightbulb className="h-4 w-4 text-amber-500" />} className="md:col-span-3 lg:col-span-3">
          <div className="space-y-3">
            <AlertasRC compact limit={3} />
            <Button variant="link" className="text-[10px] font-black uppercase p-0 h-auto" onClick={() => navigate('/alertas')}>Ver todos os alertas</Button>
          </div>
        </BentoCard>

        <BentoCard title="Performance Operacional" subtitle="Volume & Desconto" icon={<Target className="h-4 w-4" />} className="md:col-span-3 lg:col-span-3">
          <div className="grid grid-cols-2 gap-6 h-full items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Volume Total</p>
              <div className="text-xl font-black">{fmtNum(kpis.vol)} <span className="text-xs font-bold text-slate-400">KG</span></div>
              <div className="text-[10px] font-bold text-emerald-500">{fmtPct(kpis.atingVol)} da meta</div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Desconto Médio</p>
              <div className="text-xl font-black text-rose-500">{fmtPct(kpis.desc)}</div>
              <div className="text-[10px] font-bold text-slate-400">Impacto na Comissão</div>
            </div>
          </div>
        </BentoCard>
      </BentoGrid>

      <ClientesInativosCard rcCode={representativeCode} gestorCode={isGestor ? gestorCode : null} />

      <div className="premium-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Realizado vs Meta por Linha</h3>
          <Badge variant="outline" className="text-[10px] font-bold uppercase border-slate-200">Visão Geral</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Linha de Produto</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Faturamento</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Meta</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">% Ating.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porLinha.map((l) => (
                <TableRow key={l.linha} className="border-slate-50 dark:border-white/5">
                  <TableCell className="py-4 font-bold text-xs">{l.linha}</TableCell>
                  <TableCell className="py-4 text-right font-black text-xs">{fmtBRL(l.fat)}</TableCell>
                  <TableCell className="py-4 text-right text-xs text-muted-foreground">{fmtBRL(l.meta)}</TableCell>
                  <TableCell className="py-4 text-right">
                    <Badge variant={l.meta > 0 && l.fat/l.meta >= 1 ? "default" : "secondary"} className="text-[10px] font-bold">
                      {l.meta > 0 ? fmtPct(l.fat/l.meta) : "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {porLinha.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground text-xs italic">Nenhum dado encontrado para o período.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default MeuPainel;
