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

function normalizeProviderName(provider?: string) {
  return provider === "openai" ? "openai" : "gemini";
}

async function processJob(supabase: any, jobId: string) {
  try {
    const { data: job, error: jobFetchError } = await supabase
      .from("insight_queue")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobFetchError || !job) {
      console.error(`[QUEUE] Job ${jobId} not found`, jobFetchError);
      return;
    }

    // Update to processing
    await supabase
      .from("insight_queue")
      .update({ status: "processing" })
      .eq("id", jobId);

    const { mes, modo, provider: providerName, organizacao_id: orgId } = job;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // --- REUSE DATA FETCHING LOGIC FROM gestor-insights-ia ---
    // (In a real scenario, we might want to share this code, but here we inline/adapt it)
    
     const currentMonthDate = new Date(`${mes}-01T00:00:00`);
     const prevMonthDate = new Date(currentMonthDate);
     prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
     const mesAnterior = prevMonthDate.toISOString().slice(0, 7);

     const inicioMes = `${mes}-01`;
     const fimMesDate = new Date(currentMonthDate);
     fimMesDate.setMonth(fimMesDate.getMonth() + 1);
     fimMesDate.setDate(0);
     const fimMes = fimMesDate.toISOString().slice(0, 10);

     const [vRes, mRes, rRes, aRes, acRes, pRes, vHistoricoRes, cRes, lRes] = await Promise.all([
      supabase.from("vendas").select("*").eq("organizacao_id", orgId).limit(50000),
      supabase.from("metas").select("*").eq("organizacao_id", orgId).eq("mes_ano", mes),
      supabase.from("representantes").select("*").eq("organizacao_id", orgId),
      supabase.from("alertas_rc").select("*").eq("organizacao_id", orgId).eq("mes_referencia", mes),
      supabase.from("acoes_gestor").select("*").eq("organizacao_id", orgId),
      supabase.from("pedidos_aberto").select("*").eq("organizacao_id", orgId).limit(50000),
      supabase.from("vendas").select("*").eq("organizacao_id", orgId).neq("mes_ano", mes).order("mes_ano", { ascending: false }).limit(20000),
      supabase.from("clientes").select("codigo, razao_social").eq("organizacao_id", orgId),
      supabase.from("organizacoes").select("nome").eq("id", orgId).single(),
    ]);

    const vendasRaw = vRes.data ?? [];
    const metas = mRes.data ?? [];
    const repsAll = rRes.data ?? [];
    const alertas = aRes.data ?? [];
    const acoes = acRes.data ?? [];
    const pedidosRaw = pRes.data ?? [];
    const clientesCadastrados = cRes.data ?? [];

    const reps = repsAll.filter((r: any) => (r.status ?? "ativo") !== "inativo");
    const codsAtivos = new Set(reps.map((r: any) => r.cod_rc).filter(Boolean));
    const codsInativos = new Set(repsAll.filter((r: any) => r.status === "inativo").map((r: any) => r.cod_rc).filter(Boolean));
    const nomesInativos = repsAll.filter((r: any) => r.status === "inativo").map((r: any) => r.nome);
    
    const vendas = vendasRaw.filter((v: any) => !v.cod_rc || !codsInativos.has(v.cod_rc));
    const metasFiltradas = metas.filter((m: any) => !m.cod_rc || !codsInativos.has(m.cod_rc));

    const ultimoSnapshot = pedidosRaw.reduce((acc: string, p: any) => p.data_snapshot && p.data_snapshot > acc ? p.data_snapshot : acc, "");
    const pedidosAberto = pedidosRaw.filter((p: any) => (!ultimoSnapshot || p.data_snapshot === ultimoSnapshot) && (!p.cod_rc || !codsInativos.has(p.cod_rc)));

    const vendasHistorico = vHistoricoRes.data ?? [];
    const vendasMes = vendas.filter((v: any) => (v.mes_ano || v.mes) === mes);
    const sum = (arr: any[], k: string) => arr.reduce((a, x) => a + (Number(x[k]) || 0), 0);

    const fatTotal = sum(vendasMes, "faturamento_realizado");
    const metaTotal = sum(metasFiltradas, "meta_faturamento");
    const volTotal = sum(vendasMes, "volume_kg");
    const metaVol = sum(metasFiltradas, "meta_volume");
    const mbTotal = sum(vendasMes, "mb_cb_total");
    const carteiraTotal = sum(pedidosAberto, "valor");
    const carteiraVol = sum(pedidosAberto, "volume");

    const hoje = new Date();
    const fimMesD = new Date(fimMes + "T00:00:00");
    const diaDoMes = hoje.getDate();
    const totalDiasMes = fimMesD.getDate();
    const expectedPct = Math.min(1, diaDoMes / totalDiasMes);
    const inicioMesFlag = diaDoMes <= 5;
    const projecaoMinima = fatTotal + carteiraTotal;
    const projecaoExtrapolada = expectedPct > 0 ? fatTotal / expectedPct : fatTotal;
    const projecaoMes = inicioMesFlag ? projecaoMinima : Math.max(projecaoExtrapolada, projecaoMinima);

    // Contexto resumido para IA (para não estourar tokens se for via queue)
    const contexto = {
      periodo: mes,
      atingimento_atual: metaTotal > 0 ? fmtPct(fatTotal / metaTotal) : "—",
      meta_faturamento: fmtBRL(metaTotal),
      faturamento_realizado: fmtBRL(fatTotal),
      projecao_fim_mes: fmtBRL(projecaoMes),
      alertas_pendentes: alertas.filter((a: any) => a.status === "pendente").length,
      // ... adicione mais campos se necessário
    };

    const isResumo = modo === "resumo";
    const systemPrompt = isResumo
      ? `Você é um analista de vendas sênior B2B. Gere um insight EXECUTIVO em até 3 frases em português. Mencione realizado+carteira vs meta.`
      : `Você é um consultor de vendas B2B sênior. Analise os dados e produza um diagnóstico estratégico estruturado em Markdown com as seções: ## 📊 Diagnóstico, ## 👥 Representantes, ## 💡 Plano de Ação. Forneça soluções de CURTO e MÉDIO prazo.`;

    const AI_PROVIDERS = [
      { name: "gemini", model: "google/gemini-2.5-flash", key: LOVABLE_API_KEY, gateway: true },
      { name: "openai", model: "gpt-4o-mini", key: Deno.env.get("OPENAI_API_KEY"), gateway: false },
    ];
    const normalizedProviderName = normalizeProviderName(providerName);
    const requestedProvider = AI_PROVIDERS.find(p => p.name === normalizedProviderName && p.key);
    let provider = requestedProvider ?? AI_PROVIDERS.find(p => p.key) ?? AI_PROVIDERS[0];
    const fallbackProviders = AI_PROVIDERS.filter(p => p.key && p.name !== provider.name);

    const getConfig = (p: typeof AI_PROVIDERS[0]) => ({
      url: p.gateway ? "https://ai.gateway.lovable.dev/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${p.gateway ? LOVABLE_API_KEY : p.key}`
      },
      body: {
        model: p.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados:\n${JSON.stringify(contexto)}` },
        ],
      }
    });

    let aiResp = await fetch(getConfig(provider).url, {
      method: "POST",
      headers: getConfig(provider).headers,
      body: JSON.stringify(getConfig(provider).body)
    });
    let lastErrorText = aiResp.ok ? "" : await aiResp.clone().text();
    console.log(`[QUEUE] Provider ${provider.name} returned ${aiResp.status}`);

    if (!aiResp.ok) {
      for (const fallbackProvider of fallbackProviders) {
        console.warn(`[QUEUE] ${provider.name} failed (${aiResp.status}). Trying ${fallbackProvider.name} fallback.`);
        const fallbackConfig = getConfig(fallbackProvider);
        const retryResp = await fetch(fallbackConfig.url, {
          method: "POST",
          headers: fallbackConfig.headers,
          body: JSON.stringify(fallbackConfig.body)
        });
        if (retryResp.ok) {
          aiResp = retryResp;
          provider = fallbackProvider;
          lastErrorText = "";
          break;
        }
        lastErrorText = await retryResp.clone().text();
        console.warn(`[QUEUE] ${fallbackProvider.name} fallback failed (${retryResp.status}): ${lastErrorText.slice(0, 500)}`);
      }
    }

    if (!aiResp.ok) throw new Error(`AI Provider error: ${aiResp.status} - ${lastErrorText.slice(0, 300)}`);

    const aiData = await aiResp.json();
    const insight = aiData.choices?.[0]?.message?.content ?? "";

    // Complete job
    await supabase
      .from("insight_queue")
      .update({
        status: "completed",
        insight,
        contexto,
        provider: provider.name,
        completed_at: new Date().toISOString()
      })
      .eq("id", jobId);

  } catch (e) {
    console.error(`[QUEUE] Error processing job ${jobId}:`, e);
    await supabase
      .from("insight_queue")
      .update({
        status: "failed",
        error_message: e instanceof Error ? e.message : "Erro desconhecido"
      })
      .eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    
    // User client to verify auth
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    // Admin client to handle queue
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const { action, jobId, mes, modo, provider } = await req.json();
    const normalizedProvider = normalizeProviderName(provider);

    if (action === "enqueue") {
      // 1) Verify org
      const { data: membro } = await supabase.from("organizacao_membros").select("organizacao_id").eq("user_id", user.id).single();
      if (!membro) throw new Error("Organização não encontrada");

      const orgId = membro.organizacao_id;

      // 1.1) Check for recent completed job (Cache - 15 minutes)
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentJob } = await supabase
        .from("insight_queue")
        .select("id, status, insight")
        .eq("organizacao_id", orgId)
        .eq("mes", mes)
        .eq("modo", modo || "resumo")
        .eq("provider", normalizedProvider)
        .eq("status", "completed")
        .gt("completed_at", fifteenMinsAgo)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentJob) {
        console.log(`[QUEUE] Reusing recent job ${recentJob.id}`);
        return new Response(JSON.stringify({ jobId: recentJob.id, status: "completed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1.2) Check for existing pending/processing job to avoid duplicates
      const { data: activeJob } = await supabase
        .from("insight_queue")
        .select("id")
        .eq("organizacao_id", orgId)
        .eq("mes", mes)
        .eq("modo", modo || "resumo")
        .eq("provider", normalizedProvider)
        .in("status", ["pending", "processing"])
        .limit(1)
        .maybeSingle();

      if (activeJob) {
        console.log(`[QUEUE] Job already in progress: ${activeJob.id}`);
        return new Response(JSON.stringify({ jobId: activeJob.id, status: "pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2) Add to queue
      const { data: job, error: insertError } = await supabase
        .from("insight_queue")
        .insert({
          organizacao_id: orgId,
          user_id: user.id,
          mes,
          modo: modo || "resumo",
          provider: normalizedProvider,
          status: "pending"
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3) Start processing (background)
      // Fire and forget in Edge Function (using EdgeRuntime.waitUntil or just not awaiting)
      // Since Deno.serve handles concurrent requests, we just don't await the processJob
      processJob(supabase, job.id);

      return new Response(JSON.stringify({ jobId: job.id, status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "poll") {
      if (!jobId) throw new Error("jobId é obrigatório para polling");
      const { data: job, error } = await supabase
        .from("insight_queue")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
