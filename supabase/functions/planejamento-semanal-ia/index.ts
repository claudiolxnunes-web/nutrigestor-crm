import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeProviderName(provider?: string) {
  return provider === "gemini" ? "gemini" : "openai";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!OPENAI_KEY && !LOVABLE_API_KEY) throw new Error("Nenhum provedor de IA configurado");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { mes_referencia, semana_ano, provider, force } = await req.json();
    if (!mes_referencia || !semana_ano) throw new Error("Parâmetros mes_referencia e semana_ano são obrigatórios");

    const normalizedProvider = normalizeProviderName(provider);

    // 1) Identifica papel e organização
    const { data: membro } = await supabase.from("organizacao_membros")
      .select("organizacao_id, papel")
      .eq("user_id", user.id)
      .single();
    if (!membro) throw new Error("Organização não encontrada");

    const orgId = membro.organizacao_id;
    const tipoUsuario = membro.papel === "gestor" ? "gestor" : "rc";

    // 2) Busca dados do RC se for o caso
    let codRc = null;
    if (tipoUsuario === "rc") {
      const { data: rep } = await supabase.from("representantes")
        .select("cod_rc")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      codRc = rep?.cod_rc;
    }

    // 3) Verifica cache se não for force
    if (!force) {
      const { data: cache } = await supabase.from("planejamento_ia")
        .select("*")
        .eq("organizacao_id", orgId)
        .eq("user_id", user.id)
        .eq("mes_referencia", mes_referencia)
        .eq("semana_ano", semana_ano)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cache) {
        return new Response(JSON.stringify(cache), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 4) Coleta de dados massiva para contexto
    // Buscamos dados do mês atual e dos últimos meses para inatividade
    const [vRes, mRes, pRes, acRes, rRes] = await Promise.all([
      // Vendas recentes
      supabase.from("vendas").select("*").eq("organizacao_id", orgId).gte("mes_ano", mes_referencia).limit(1000),
      // Metas do mês
      supabase.from("metas").select("*").eq("organizacao_id", orgId).eq("mes_ano", mes_referencia),
      // Pedidos em aberto
      supabase.from("pedidos_aberto").select("*").eq("organizacao_id", orgId),
      // Ações do gestor
      supabase.from("acoes_gestor").select("*").eq("organizacao_id", orgId).eq("status", "aberta"),
      // Clientes em risco/inativos (buscando da tabela clientes que já tem o flag ou data)
      supabase.from("clientes").select("*").eq("organizacao_id", orgId).limit(500)
    ]);

    // Filtra dados pelo RC se não for gestor
    let contextData: any = {
      tipoUsuario,
      mes_referencia,
      semana_ano,
      vendas: vRes.data?.filter(v => !codRc || v.cod_rc === codRc).slice(0, 50),
      metas: mRes.data?.filter(m => !codRc || m.cod_rc === codRc),
      pedidos_aberto: pRes.data?.filter(p => !codRc || p.cod_rc === codRc).slice(0, 50),
      acoes_abertas: acRes.data?.filter(a => tipoUsuario === "gestor" || a.rc_user_id === user.id),
      clientes_analise: rRes.data?.filter(c => !codRc || c.cod_rc === codRc).slice(0, 100)
    };

    // 5) Chamada para IA
    const systemPrompt = `Você é um consultor de estratégia comercial focado no AGRO.
Sua tarefa é gerar um PLANEJAMENTO SEMANAL (Semana ${semana_ano} de ${mes_referencia}) altamente prático.
${tipoUsuario === 'gestor' ? 'Você está falando com o GESTOR. Foco em KPIs, RCs em risco, grandes contas e gargalos da operação.' : 'Você está falando com o REPRESENTANTE (RC). Foco em visitas prioritárias, recuperação de inativos, fechamento de propostas e roteirização.'}

Baseie-se nos dados fornecidos: vendas atuais vs metas, clientes que não compram há tempo, e pedidos travados.

RESPOSTA OBRIGATÓRIA EM DOIS FORMATOS:
1. Um texto rico em MARKDOWN para leitura humana.
2. Um bloco JSON no final contendo sugestões de follow-up estruturadas.

Estrutura Markdown:
## 📅 Prioridades da Semana
## 🎯 Foco em Clientes (cite nomes reais)
## 💡 Dicas de Abordagem
## ⚠️ Pontos de Atenção

Estrutura JSON (DEVE ESTAR ENTRE TAGS <FOLLOWUP_JSON> e </FOLLOWUP_JSON>):
[
  {
    "cliente": "NOME DO CLIENTE",
    "codigo_cliente": "CODIGO SE DISPONIVEL",
    "data": "YYYY-MM-DD (dentro da semana atual)",
    "canal": "whatsapp" | "email",
    "mensagem": "Texto sugerido para o contato"
  }
]

Seja motivador, use os nomes reais dos clientes fornecidos.`;

    const model = normalizedProvider === "openai" ? "gpt-4o-mini" : "google/gemini-2.5-flash";
    const apiUrl = normalizedProvider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = normalizedProvider === "openai" ? Deno.env.get("OPENAI_API_KEY") : LOVABLE_API_KEY;

    const aiResp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados da operação:\n${JSON.stringify(contextData)}` }
        ],
        temperature: 0.7
      })
    });

    if (!aiResp.ok) {
      const errorText = await aiResp.text();
      throw new Error(`Erro na IA (${aiResp.status}): ${errorText}`);
    }

    const aiData = await aiResp.json();
    const fullContent = aiData.choices[0].message.content;

    // Extrai Markdown e JSON
    let planoMarkdown = fullContent;
    let metadados = { sugestoes_followup: [] };

    const jsonMatch = fullContent.match(/<FOLLOWUP_JSON>([\s\S]*?)<\/FOLLOWUP_JSON>/);
    if (jsonMatch) {
      try {
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        metadados.sugestoes_followup = parsedJson;
        // Remove o JSON do markdown exibido para o usuário
        planoMarkdown = fullContent.replace(/<FOLLOWUP_JSON>[\s\S]*?<\/FOLLOWUP_JSON>/, "").trim();
      } catch (e) {
        console.error("Erro ao parsear JSON de follow-up:", e);
      }
    }

    // 6) Salva no banco
    const { data: saved, error: saveError } = await supabase.from("planejamento_ia").insert({
      organizacao_id: orgId,
      user_id: user.id,
      mes_referencia,
      semana_ano,
      tipo_usuario: tipoUsuario,
      cod_rc: codRc,
      plano_markdown: planoMarkdown,
      contexto_json: contextData,
      metadados: metadados,
      provider: normalizedProvider
    }).select().single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify(saved), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
