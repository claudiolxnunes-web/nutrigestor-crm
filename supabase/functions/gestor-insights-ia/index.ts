import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmtBRL = (n: number) => {
  if (typeof n !== "number" || isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtPct = (n: number) => {
  if (typeof n !== "number" || isNaN(n)) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!OPENAI_KEY && !LOVABLE_API_KEY) {
      console.error("[DEBUG] Nenhuma chave de IA configurada (OPENAI_API_KEY ou LOVABLE_API_KEY)");
      throw new Error("Nenhum provedor de IA configurado. Configure OPENAI_API_KEY nas secrets do Supabase.");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { mes, modo } = await req.json(); // modo: 'resumo' | 'completo'
    if (!mes) throw new Error("mes é obrigatório (formato YYYY-MM)");

    // 1) Pega org do usuário
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Não autenticado");

    const { data: membro, error: membroError } = await supabase
      .from("organizacao_membros")
      .select("organizacao_id, papel")
      .eq("user_id", userId)
      .maybeSingle();

    if (membroError) {
      console.error("[DEBUG] Erro ao buscar membro:", membroError);
      throw new Error(`Erro ao verificar permissões: ${membroError.message}`);
    }

    if (!membro) {
      console.warn("[DEBUG] Usuário sem organização vinculada:", userId);
      throw new Error("Sua conta não possui uma organização vinculada. Entre em contato com o suporte.");
    }
    
    if (membro.papel !== "gestor") {
      console.warn("[DEBUG] Usuário sem papel de gestor:", userId, "Papel:", membro.papel);
      throw new Error("Apenas gestores podem usar o assistente de IA.");
    }
    const orgId = membro.organizacao_id;

     // 2) Busca dados da carteira / metas / alertas
     const currentMonthDate = new Date(`${mes}-01T00:00:00`);
     const prevMonthDate = new Date(currentMonthDate);
     prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
     const mesAnterior = prevMonthDate.toISOString().slice(0, 7);
 
     const inicioMes = `${mes}-01`;
     const fimMesDate = new Date(currentMonthDate);
     fimMesDate.setMonth(fimMesDate.getMonth() + 1);
     fimMesDate.setDate(0);
     const fimMes = fimMesDate.toISOString().slice(0, 10);
 
     const [vRes, mRes, rRes, aRes, acRes, pRes, vHistoricoRes, cRes, lRes, alertsAutoRes] = await Promise.all([
      supabase.from("vendas")
        .select("cod_rc, representante, linha, faturamento_realizado, mb_cb_total, ml_cb_total, volume_kg, mes_ano, nome_cliente")
        .eq("organizacao_id", orgId).limit(50000),
      supabase.from("metas")
        .select("cod_rc, representante, linha, mes_ano, meta_faturamento, meta_volume")
        .eq("organizacao_id", orgId).eq("mes_ano", mes),
      supabase.from("representantes")
        .select("cod_rc, nome, status").eq("organizacao_id", orgId),
      supabase.from("alertas_rc")
        .select("tipo, severidade, status, motivo_categoria, motivo_detalhe, rc_nome, cliente_nome, prazo_resposta, created_at")
        .eq("organizacao_id", orgId).eq("mes_referencia", mes),
      supabase.from("acoes_gestor")
        .select("status, prioridade, rc_nome").eq("organizacao_id", orgId),
       supabase.from("pedidos_aberto")
         .select("cod_rc, rc_nome, linha, valor, volume, bloqueio, data_snapshot, pedido, cod_produto, cod_cliente, cliente_nome")
         .eq("organizacao_id", orgId).limit(50000),
        supabase.from("vendas")
          .select("cod_rc, cod_cliente, nome_cliente, faturamento_realizado, volume_kg, mes_ano")
          .eq("organizacao_id", orgId)
          .neq("mes_ano", mes)
          .order("mes_ano", { ascending: false })
          .limit(20000),
         supabase.from("clientes").select("id, codigo, razao_social").eq("organizacao_id", orgId),
          supabase.from("organizacoes").select("nome").eq("id", orgId).single(),
          modo === "completo" ? supabase.rpc("gerar_alertas_rc" as any, { _org_id: orgId, _mes_ano: mes }) : Promise.resolve({ data: null })
    ]);

    const vendasRaw = vRes.data ?? [];
    const metas = mRes.data ?? [];
    const repsAll = rRes.data ?? [];
    const alertas = aRes.data ?? [];
    const acoes = acRes.data ?? [];
      const pedidosRaw = pRes.data ?? [];
       const clientesCadastrados = cRes.data ?? [];
       const orgNome = lRes.data?.nome ?? "";

    // Filtra apenas RCs ATIVOS — inativos não devem entrar na análise
    const reps = repsAll.filter((r: any) => (r.status ?? "ativo") !== "inativo");
    const codsAtivos = new Set(reps.map((r: any) => r.cod_rc).filter(Boolean));
    const codsInativos = new Set(
      repsAll.filter((r: any) => r.status === "inativo").map((r: any) => r.cod_rc).filter(Boolean)
    );
    const nomesInativos = repsAll.filter((r: any) => r.status === "inativo").map((r: any) => r.nome);
    // Remove vendas/metas de RCs marcados como inativos
    const vendas = vendasRaw.filter((v: any) => !v.cod_rc || !codsInativos.has(v.cod_rc));
    const metasFiltradas = metas.filter((m: any) => !m.cod_rc || !codsInativos.has(m.cod_rc));

    // Pedidos em aberto: usa o snapshot mais recente e remove RCs inativos
    const ultimoSnapshot = pedidosRaw.reduce((acc: string, p: any) => {
      return p.data_snapshot && p.data_snapshot > acc ? p.data_snapshot : acc;
    }, "");
    const pedidosAberto = pedidosRaw.filter((p: any) =>
      (!ultimoSnapshot || p.data_snapshot === ultimoSnapshot) &&
      (!p.cod_rc || !codsInativos.has(p.cod_rc))
    );

    // 3) Agrega métricas
    const vendasHistorico = vHistoricoRes.data ?? [];
    const vendasMes = vendas.filter((v: any) => (v.mes_ano || v.mes) === mes);
    const sum = (arr: any[], k: string) => arr.reduce((a, x) => a + (Number(x[k]) || 0), 0);

    const fatTotal = sum(vendasMes, "faturamento_realizado");
    const metaTotal = sum(metasFiltradas, "meta_faturamento");

    console.log(`[DEBUG] OrgId: ${orgId}, Mês: ${mes}, Modo: ${modo}, Vendas: ${vendasMes.length}, Metas: ${metasFiltradas.length}, Fat: ${fatTotal}, Meta: ${metaTotal}`);

    if (vendasMes.length === 0 && metasFiltradas.length === 0) {
      console.warn(`[DEBUG] Nenhum dado de venda ou meta encontrado para Org ${orgId} no mês ${mes}`);
    }

    const volTotal = sum(vendasMes, "volume_kg");
    const metaVol = sum(metasFiltradas, "meta_volume");
    const mbTotal = sum(vendasMes, "mb_cb_total");


    // Carteira em aberto agregada
    const carteiraTotal = sum(pedidosAberto, "valor");
    const carteiraVol = sum(pedidosAberto, "volume");

    const hoje = new Date();
    const fimMesD = new Date(fimMes + "T00:00:00");
    const diaDoMes = hoje.getDate();
    const totalDiasMes = fimMesD.getDate();
    const expectedPct = Math.min(1, diaDoMes / totalDiasMes);
    const inicioMesFlag = diaDoMes <= 5;
    // Projeção mínima = realizado + carteira em aberto (compromissado)
    const projecaoMinima = fatTotal + carteiraTotal;
    // Projeção tendencial: no início do mês prioriza carteira; depois extrapola realizado, com piso na projeção mínima
    const projecaoExtrapolada = expectedPct > 0 ? fatTotal / expectedPct : fatTotal;
    const projecaoMes = inicioMesFlag
      ? projecaoMinima
      : Math.max(projecaoExtrapolada, projecaoMinima);
    const gapProjetado = metaTotal - projecaoMes;
    const gapMinimo = metaTotal - projecaoMinima;
    const carteiraVsMetaPct = metaTotal > 0 ? carteiraTotal / metaTotal : 0;

    // Por RC
    const porRc = new Map<string, any>();
    reps.forEach((r: any) => {
      porRc.set(r.cod_rc, { cod_rc: r.cod_rc, nome: r.nome, fat: 0, meta: 0, vol: 0, metaVol: 0, carteira: 0, carteiraVol: 0 });
    });
    vendasMes.forEach((v: any) => {
      // Ignora vendas órfãs de RCs inativos / não cadastrados como ativos
      if (v.cod_rc && !codsAtivos.has(v.cod_rc)) return;
      const cur = porRc.get(v.cod_rc) ?? { cod_rc: v.cod_rc, nome: v.representante, fat: 0, meta: 0, vol: 0, metaVol: 0, carteira: 0, carteiraVol: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      porRc.set(v.cod_rc, cur);
    });
    metasFiltradas.forEach((m: any) => {
      const cur = porRc.get(m.cod_rc) ?? { cod_rc: m.cod_rc, nome: m.representante, fat: 0, meta: 0, vol: 0, metaVol: 0, carteira: 0, carteiraVol: 0 };
      cur.meta += Number(m.meta_faturamento) || 0;
      cur.metaVol += Number(m.meta_volume) || 0;
      porRc.set(m.cod_rc, cur);
    });
    pedidosAberto.forEach((p: any) => {
      if (p.cod_rc && !codsAtivos.has(p.cod_rc)) return;
      const cur = porRc.get(p.cod_rc) ?? { cod_rc: p.cod_rc, nome: p.rc_nome, fat: 0, meta: 0, vol: 0, metaVol: 0, carteira: 0, carteiraVol: 0 };
      cur.carteira += Number(p.valor) || 0;
      cur.carteiraVol += Number(p.volume) || 0;
      porRc.set(p.cod_rc, cur);
    });
    const equipe = Array.from(porRc.values()).map((r) => ({
      ...r,
      atingPct: r.meta > 0 ? r.fat / r.meta : 0,
      projecaoMin: r.fat + r.carteira,
      projecaoMinPct: r.meta > 0 ? (r.fat + r.carteira) / r.meta : 0,
      carteiraPct: r.meta > 0 ? r.carteira / r.meta : 0,
      gap: r.meta - (inicioMesFlag ? (r.fat + r.carteira) : Math.max(r.fat / Math.max(expectedPct, 0.01), r.fat + r.carteira)),
    })).sort((a, b) => a.atingPct - b.atingPct);

    // Risco: realizado + carteira fica bem abaixo da meta (< 70%)
    const rcsRisco = equipe.filter((r) => r.meta > 0 && r.projecaoMinPct < 0.7);
    // Carteira baixa: representante com carteira < 20% da meta (sinal de pipeline fraco)
    const rcsCarteiraBaixa = equipe.filter((r) => r.meta > 0 && r.carteiraPct < 0.2).sort((a, b) => a.carteiraPct - b.carteiraPct);
    // Carteira alta / tendência positiva: realizado + carteira já cobre boa parte da meta
    const rcsForte = equipe.filter((r) => r.meta > 0 && r.projecaoMinPct >= 0.9).sort((a, b) => b.projecaoMinPct - a.projecaoMinPct);

    // Alertas
    const alertasPendentes = alertas.filter((a: any) => a.status === "pendente").length;
    const alertasVencidos = alertas.filter((a: any) => a.status === "pendente" && a.prazo_resposta && new Date(a.prazo_resposta) < hoje).length;
    const motivoMap = new Map<string, number>();
    alertas.filter((a: any) => a.motivo_categoria).forEach((a: any) => {
      motivoMap.set(a.motivo_categoria, (motivoMap.get(a.motivo_categoria) ?? 0) + 1);
    });
    const topMotivos = Array.from(motivoMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Por linha
    const porLinha = new Map<string, any>();
    vendasMes.forEach((v: any) => {
      const k = v.linha || "—";
      const cur = porLinha.get(k) ?? { linha: k, fat: 0, meta: 0, carteira: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      porLinha.set(k, cur);
    });
    metasFiltradas.forEach((m: any) => {
      const k = m.linha || "—";
      const cur = porLinha.get(k) ?? { linha: k, fat: 0, meta: 0, carteira: 0 };
      cur.meta += Number(m.meta_faturamento) || 0;
      porLinha.set(k, cur);
    });
    pedidosAberto.forEach((p: any) => {
      const k = p.linha || "—";
      const cur = porLinha.get(k) ?? { linha: k, fat: 0, meta: 0, carteira: 0 };
      cur.carteira += Number(p.valor) || 0;
      porLinha.set(k, cur);
    });
    const linhas = Array.from(porLinha.values()).filter((l) => l.meta > 0)
      .map((l) => ({ ...l, atingPct: l.fat / l.meta, projMinPct: (l.fat + l.carteira) / l.meta }))
      .sort((a, b) => a.projMinPct - b.projMinPct);

    // 4) Monta contexto factual para a IA
     const porCliente = new Map<string, any>();
     const getCliente = (cod: string, nome: string) => {
       if (!porCliente.has(cod)) {
         porCliente.set(cod, { cod, nome: nome || "Cliente s/ nome", fat_mes: 0, vol_mes: 0, fat_hist: 0, vol_hist: 0, pedidos_aberto: 0, meses_ativos: new Set(), ultimo_mes: "" });
       }
       return porCliente.get(cod);
     };

     vendasMes.forEach((v: any) => {
       if (!v.cod_cliente) return;
       const c = getCliente(v.cod_cliente, v.nome_cliente);
       c.fat_mes += Number(v.faturamento_realizado) || 0;
       c.vol_mes += Number(v.volume_kg) || 0;
       c.meses_ativos.add(v.mes_ano);
     });

     vendasHistorico.forEach((v: any) => {
       if (!v.cod_cliente) return;
       const c = getCliente(v.cod_cliente, v.nome_cliente);
       c.fat_hist += Number(v.faturamento_realizado) || 0;
       c.vol_hist += Number(v.volume_kg) || 0;
       c.meses_ativos.add(v.mes_ano);
       if (v.mes_ano > c.ultimo_mes) c.ultimo_mes = v.mes_ano;
     });

     pedidosAberto.forEach((p: any) => {
       if (!p.cod_cliente) return;
       const c = getCliente(p.cod_cliente, p.cliente_nome);
       c.pedidos_aberto += Number(p.valor) || 0;
     });


      // Cálculo de Carteira Flutuante
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      const limiteInatividade = seisMesesAtras.toISOString().slice(0, 7); // YYYY-MM

       // Mapeia TODOS os clientes cadastrados para garantir que os inativos totais apareçam
       // Cálculo do mês anterior para comparação
       const seisMesesAtrasAnterior = new Date(prevMonthDate);
       seisMesesAtrasAnterior.setMonth(seisMesesAtrasAnterior.getMonth() - 6);
       const limiteInatividadeAnterior = seisMesesAtrasAnterior.toISOString().slice(0, 7);
 
       const porClienteAnterior = new Map();
       vendasHistorico.filter((v: any) => v.mes_ano <= mesAnterior).forEach((v: any) => {
         if (!v.cod_cliente) return;
         const c = porClienteAnterior.get(v.cod_cliente) ?? { cod: v.cod_cliente, fat_mes_ant: 0, ultimo_mes_ant: "" };
         if (v.mes_ano === mesAnterior) c.fat_mes_ant += Number(v.faturamento_realizado) || 0;
         if (v.mes_ano > c.ultimo_mes_ant) c.ultimo_mes_ant = v.mes_ano;
         porClienteAnterior.set(v.cod_cliente, c);
       });

       const calcVar = (atual: number, anterior: number) => ({
         absoluta: atual - anterior,
         percentual: anterior > 0 ? ((atual - anterior) / anterior * 100).toFixed(1) + "%" : (atual > 0 ? "100%" : "0%")
       });

       // Mapeia TODOS os clientes cadastrados
       const todosClientesMap = new Map();
       clientesCadastrados.forEach(c => {
         todosClientesMap.set(c.codigo, {
           cod: c.codigo,
           nome: c.razao_social,
           ultimo_mes: "Sem histórico",
           fat_mes: 0,
           fat_mes_ant: 0,
           is_ativo: false,
           is_positivado: false,
           pedidos_aberto: 0
         });
       });
 
       // Mescla com dados do mês atual
       Array.from(porCliente.values()).forEach(c => {
         const existing = todosClientesMap.get(c.cod);
         const isAtivo = c.ultimo_mes >= limiteInatividade || c.fat_mes > 0;
         const isPositivado = c.fat_mes > 0;
 
         if (existing) {
           existing.ultimo_mes = c.ultimo_mes || "Sem histórico";
           existing.fat_mes = c.fat_mes;
           existing.is_ativo = isAtivo;
           existing.is_positivado = isPositivado;
           existing.pedidos_aberto = c.pedidos_aberto;
         } else {
           todosClientesMap.set(c.cod, {
             cod: c.cod,
             nome: c.nome,
             ultimo_mes: c.ultimo_mes || "Sem histórico",
             fat_mes: c.fat_mes,
             fat_mes_ant: 0,
             is_ativo: isAtivo,
             is_positivado: isPositivado,
             pedidos_aberto: c.pedidos_aberto
           });
         }
       });

       // Mescla com dados do mês anterior
       Array.from(porClienteAnterior.values()).forEach(c => {
         const existing = todosClientesMap.get(c.cod);
         if (existing) {
           existing.fat_mes_ant = c.fat_mes_ant;
           // Atualiza recência se for maior (pode ser o caso se o cliente não comprou este mês)
           if (c.ultimo_mes_ant > existing.ultimo_mes || existing.ultimo_mes === "Sem histórico") {
             existing.ultimo_mes = c.ultimo_mes_ant;
           }
         }
       });
 
        const listaDetalhesClientes = Array.from(todosClientesMap.values()).map(c => ({
          ...c,
          variacao: calcVar(c.fat_mes, c.fat_mes_ant)
        }));
 
        const clientesAtivos = listaDetalhesClientes.filter(c => c.is_ativo).length;
        const clientesInativosLongaData = listaDetalhesClientes.filter(c => !c.is_ativo).length;
        const clientesPositivadosNoMes = listaDetalhesClientes.filter(c => c.is_positivado).length;

       const listaAnterior = Array.from(porClienteAnterior.values());
       const ativosAnterior = listaAnterior.filter(c => c.ultimo_mes_ant >= limiteInatividadeAnterior).length;
       const positivadosAnterior = listaAnterior.filter(c => c.fat_mes_ant > 0).length;
       const inativosAnterior = Math.max(0, clientesCadastrados.length - ativosAnterior);
       const indiceAnterior = ativosAnterior > 0 ? (positivadosAnterior / ativosAnterior) : 0;
       const indiceAtual = clientesAtivos > 0 ? (clientesPositivadosNoMes / clientesAtivos) : 0;
      const analiseClientes = Array.from(porCliente.values()).map(c => ({
        nome: c.nome,
        performance: c.fat_mes > 0 ? (c.fat_hist / Math.max(1, c.meses_ativos.size - 1) > 0 ? fmtPct(c.fat_mes / (c.fat_hist / Math.max(1, c.meses_ativos.size - 1))) : "Novo") : "Sem compra",
        positivacao: c.meses_ativos.has(mes) ? "Positivado" : "Não positivado",
        recencia: c.ultimo_mes || "Sem histórico",
        pedidos_carteira: fmtBRL(c.pedidos_aberto)
      })).sort((a, b) => (b.positivacao === "Positivado" ? 1 : -1)).slice(0, 15);

     const contexto = {
      periodo: mes,
      dia_do_mes: `${diaDoMes}/${totalDiasMes}`,
      inicio_de_mes: inicioMesFlag,
      esperado_ate_hoje_pct: fmtPct(expectedPct),
      faturamento_realizado: fmtBRL(fatTotal),
      carteira_pedidos_aberto: fmtBRL(carteiraTotal),
      carteira_vs_meta_pct: metaTotal > 0 ? fmtPct(carteiraVsMetaPct) : "—",
      projecao_minima_realizado_mais_carteira: fmtBRL(projecaoMinima),
      gap_projecao_minima_vs_meta: metaTotal > 0 ? fmtBRL(gapMinimo) : "—",
      meta_faturamento: metaTotal > 0 ? fmtBRL(metaTotal) : "sem meta",
      atingimento_atual: metaTotal > 0 ? fmtPct(fatTotal / metaTotal) : "—",
      projecao_fim_mes: fmtBRL(projecaoMes),
      gap_vs_meta: metaTotal > 0 ? fmtBRL(gapProjetado) : "—",
      volume_kg: volTotal.toFixed(0),
      carteira_volume_kg: carteiraVol.toFixed(0),
      meta_volume: metaVol > 0 ? metaVol.toFixed(0) : "sem meta",
      margem_bruta: fatTotal > 0 ? fmtPct(mbTotal / fatTotal) : "—",
      total_rcs: reps.length,
      rcs_em_risco: rcsRisco.map((r) => ({
        cod_rc: r.cod_rc, nome: r.nome,
        realizado: fmtBRL(r.fat), carteira_aberto: fmtBRL(r.carteira),
        projecao_minima: fmtBRL(r.projecaoMin), meta: fmtBRL(r.meta),
        cobertura_realizado_mais_carteira: fmtPct(r.projecaoMinPct),
      })),
      rcs_carteira_baixa: rcsCarteiraBaixa.slice(0, 8).map((r) => ({
        cod_rc: r.cod_rc, nome: r.nome,
        carteira_aberto: fmtBRL(r.carteira), meta: fmtBRL(r.meta),
        carteira_vs_meta: fmtPct(r.carteiraPct),
      })),
      rcs_tendencia_positiva: rcsForte.slice(0, 5).map((r) => ({
        cod_rc: r.cod_rc, nome: r.nome,
        realizado: fmtBRL(r.fat), carteira_aberto: fmtBRL(r.carteira),
        cobertura_realizado_mais_carteira: fmtPct(r.projecaoMinPct),
      })),
      linhas_em_risco: linhas.slice(0, 5).map((l) => ({
        linha: l.linha,
        atingimento_realizado: fmtPct(l.atingPct),
        cobertura_com_carteira: fmtPct(l.projMinPct),
        carteira_aberto: fmtBRL(l.carteira),
      })),
      alertas_pendentes: alertasPendentes,
      alertas_com_sla_vencido: alertasVencidos,
      top_motivos_perda: topMotivos.map(([cat, n]) => `${cat}: ${n}`),
      acoes_abertas_para_gestor: acoes.filter((a: any) => a.status === "aberta").length,
        rcs_inativos_ignorados: nomesInativos.slice(0, 10),
        analise_performance_clientes: analiseClientes,
         estatisticas_carteira: {
           total_cadastrados: clientesCadastrados.length,
           ativos_ultimos_6_meses: clientesAtivos,
           inativos_mais_6_meses: Math.max(0, clientesInativosLongaData),
           positivados_no_mes: clientesPositivadosNoMes,
          indice_positivacao_carteira: fmtPct(indiceAtual),
          detalhes_clientes: listaDetalhesClientes.slice(0, 30), // Limitado para evitar estouro de tokens
          comparativo: {
            total: calcVar(clientesCadastrados.length, clientesCadastrados.length), // Total raramente muda drasticamente
            ativos: calcVar(clientesAtivos, ativosAnterior),
            inativos: calcVar(clientesInativosLongaData, inativosAnterior),
            positivados: calcVar(clientesPositivadosNoMes, positivadosAnterior),
            indice: {
              absoluta: (indiceAtual - indiceAnterior),
              percentual: calcVar(indiceAtual, indiceAnterior).percentual
            }
          }
        },
        sem_atividade: fatTotal === 0 && carteiraTotal === 0 && rcsRisco.length === reps.length
      };

    // 5) Chama Lovable AI
    const isResumo = modo === "resumo";
     const systemPrompt = isResumo
       ? `Você é um analista de vendas sênior B2B. Gere um insight EXECUTIVO em até 3 frases (máx 320 caracteres no total) em português, destacando o ponto MAIS CRÍTICO do dia. Se não houver atividade no período, mencione isso explicitamente. Mencione realizado+carteira vs meta.`
        : `Você é um consultor de vendas B2B sênior. Analise os dados FACTUAIS abaixo e produza um diagnóstico estratégico estruturado em Markdown com as seções: ## 📊 Diagnóstico da Operação, ## 👥 Performance de Representantes, ## 🚜 Análise de Clientes e Positivação, ## 💡 Plano de Ação Recomendado.

REGRAS ADICIONAIS:
- Se não houver atividade (vendas/pedidos) no período, mencione isso explicitamente no diagnóstico.
- Na seção "Plano de Ação Recomendado", forneça obrigatoriamente soluções de CURTO e MÉDIO prazo.
- Analise a "Carteira Flutuante" (clientes cadastrados ativos vs inativos há +6 meses) em relação aos positivados no mês.
- Destaque se a positivação está focada em poucos clientes ou se há recuperação de inativos.
- Cite nomes e números reais do contexto.`;

    const AI_PROVIDERS = [
      { name: "openai", model: "gpt-4o", key: Deno.env.get("OPENAI_API_KEY") },
      { name: "gemini", model: "gemini-2.0-flash", key: Deno.env.get("LOVABLE_API_KEY") },
      { name: "deepseek", model: "deepseek/deepseek-chat", key: Deno.env.get("DEEPSEEK_API_KEY") },
      { name: "perplexity", model: "perplexity/sonar-reasoning", key: Deno.env.get("PERPLEXITY_API_KEY") },
    ];

    const providerName = req.headers.get("x-ai-provider") ?? "openai";
    let provider = AI_PROVIDERS.find(p => p.name === providerName) ?? AI_PROVIDERS[0];
    
    // Fallback if requested key is missing
    if (!provider.key) {
      console.warn(`Provider ${provider.name} sem chave, usando fallback...`);
      provider = AI_PROVIDERS.find(p => !!p.key) ?? AI_PROVIDERS[0];
    }

    const getAiConfig = (p: typeof AI_PROVIDERS[0]) => {
      // Use generic gateway for everything except OpenAI (if requested directly)
      const useGateway = p.name !== "openai";
      
      return {
        url: useGateway ? "https://ai.gateway.lovable.dev/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${useGateway ? Deno.env.get("LOVABLE_API_KEY") : p.key}`
        },
        body: {
          model: p.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Dados da operação:\n\n${JSON.stringify(contexto, null, 2)}` },
          ],
        }
      };
    };

    let config = getAiConfig(provider);
    let aiResp = await fetch(config.url, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify(config.body),
    });
    
    console.log(`[DEBUG] Provedor: ${provider.name}, Status HTTP: ${aiResp.status}`);
    
    if (!aiResp.ok) {
      const errText = await aiResp.clone().text();
      console.error(`[DEBUG] Erro provedor ${provider.name}: ${aiResp.status} - ${errText}`);
    }

    // AUTO-FALLBACK: Se der erro, tenta os outros provedores em ordem
    if (!aiResp.ok) {

      console.warn(`Provedor ${provider.name} falhou com status ${aiResp.status}. Tentando fallbacks...`);
      for (const fallbackProvider of AI_PROVIDERS) {
        if (fallbackProvider.name === provider.name || !fallbackProvider.key) continue;
        
        console.log(`Tentando fallback com ${fallbackProvider.name}...`);
        const fallbackConfig = getAiConfig(fallbackProvider);

        const retryResp = await fetch(fallbackConfig.url, {
          method: "POST",
          headers: fallbackConfig.headers,
          body: JSON.stringify(fallbackConfig.body),
        });

        if (retryResp.ok) {
          aiResp = retryResp;
          provider = fallbackProvider;
          console.log(`Fallback para ${fallbackProvider.name} funcionou!`);
          break;
        } else {
          console.warn(`Fallback para ${fallbackProvider.name} também falhou (${retryResp.status})`);
        }
      }
    }

    if (!aiResp.ok) {
      const errorText = await aiResp.text();
      console.error(`[DEBUG] Falha final após fallbacks. Status: ${aiResp.status}, Body: ${errorText}`);
      
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido em todos os provedores. Tente novamente em alguns minutos." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes ou configuração de faturamento pendente." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 401) {
        return new Response(JSON.stringify({ error: "Erro de autenticação com o provedor de IA. Verifique as chaves configuradas." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`O provedor de IA retornou um erro (${aiResp.status}). Tente mudar de provedor no seletor acima.`);
    }

    const aiData = await aiResp.json();
    const insight = aiData.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ insight, contexto }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gestor-insights-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});