 import { useMemo } from "react";
 import { Venda, Meta, PedidoAberto } from "@/types/crm";
 
 type KpiParams = {
   vendas: Venda[];
   metas: Meta[];
   pedidosAberto: PedidoAberto[];
   mesCorrente: string;
 };
 
 export const useCrmKpis = ({ vendas, metas, pedidosAberto, mesCorrente }: KpiParams) => {
    const sum = (arr: any[], k: string) => {
      const total = arr.reduce((a, x) => {
        const val = x[k];
        if (val === null || val === undefined) return a;
        return a + Number(val);
      }, 0);
      return total;
    };
 
   const kpis = useMemo(() => {
     const fat = sum(vendas, "faturamento_realizado");
     const vol = sum(vendas, "volume_kg");
     const mb = sum(vendas, "mb_cb_total");
     const ml = sum(vendas, "ml_cb_total");
     const comissao = sum(vendas, "comissao_realizada");
     const fatBase = sum(vendas, "faturamento_sem_encargos");
     
     // Média ponderada de desconto se disponível
     const desc = vendas.length
       ? Math.abs(vendas.reduce((a, x) => a + (Number(x.desconto_pct) || 0), 0) / vendas.length)
       : 0;
       
     const metaFat = sum(metas, "meta_faturamento");
     const metaVol = sum(metas, "meta_volume");
 
     // Aberto (snapshot mais recente)
     // Chave: `${mes_previsto}|${cod_rc}` — mes_previsto é o mês corrente quando não há prev_faturamento.
     const abertoNoMes = pedidosAberto.filter(p => {
       const pm = p.prev_faturamento ? p.prev_faturamento.slice(0, 7) : mesCorrente;
       return pm === mesCorrente;
     });
     
     const abertoFuturo = pedidosAberto.filter(p => {
       const pm = p.prev_faturamento ? p.prev_faturamento.slice(0, 7) : mesCorrente;
       return pm > mesCorrente;
     });
 
      const fatAberto = sum(abertoNoMes, "valor") || 0;
      const volAberto = sum(abertoNoMes, "volume") || 0;
      const fatAbertoFuturo = sum(abertoFuturo, "valor") || 0;
      const volAbertoFuturo = sum(abertoFuturo, "volume") || 0;
 
     return {
       fat, vol, mb, ml, comissao, fatBase, desc,
       metaFat, metaVol,
       atingFat: metaFat > 0 ? fat / metaFat : 0,
       atingVol: metaVol > 0 ? vol / metaVol : 0,
       aberto: fatAberto,
       abertoVol: volAberto,
       abertoFuturo: fatAbertoFuturo,
       abertoFuturoVol: volAbertoFuturo,
       projFat: fat + fatAberto,
       projVol: vol + volAberto,
       projAtingFat: metaFat > 0 ? (fat + fatAberto) / metaFat : 0,
       mbPct: fatBase > 0 ? mb / fatBase : 0,
       mlPct: fatBase > 0 ? ml / fatBase : 0,
     };
   }, [vendas, metas, pedidosAberto, mesCorrente]);
 
   return kpis;
 };