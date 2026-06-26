import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const API_DOCS = {
  version: "1.0.0",
  base_url: "https://ngrepqqlvglzqnoswfug.supabase.co/functions/v1/crm-external-api",
  auth: "Bearer Token required in Authorization header",
  endpoints: [
    {
      path: "/email-analysis",
      method: "POST",
      description: "Registers an AI-analyzed email classification and creates follow-ups.",
      payload: {
        email_summary: "string",
        category: "string (e.g., 'venda', 'suporte')",
        priority: "string ('baixa', 'media', 'alta')",
        client_cnpj: "string (optional, to identify client)",
        suggested_action: "string",
        urgency_score: "number (0-100)",
        received_at: "ISO string",
        metadata: "object"
      }
    },
    {
      path: "/tasks",
      method: "POST",
      description: "Creates a new task/follow-up in the CRM.",
      payload: {
        title: "string",
        description: "string",
        priority: "string",
        due_date: "ISO string",
        client_id: "uuid (optional)"
      }
    },
    {
      path: "/clients",
      method: "GET | POST",
      description: "Read or create clients.",
      payload_post: {
        razao_social: "string",
        cnpj: "string",
        email: "string",
        cidade: "string",
        estado: "string"
      }
    },
    {
      path: "/opportunities",
      method: "GET | POST",
      description: "Read or create opportunities (interacoes with type 'oportunidade').",
      payload_post: {
        client_id: "uuid",
        title: "string",
        value: "number",
        stage: "string",
        probability: "number"
      }
    },
    {
      path: "/interactions",
      method: "POST",
      description: "Registers a client interaction/history.",
      payload: {
        client_id: "uuid",
        type: "string",
        notes: "string",
        date: "ISO string"
      }
    }
  ]
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", message: "Bearer token required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.split(" ")[1];
    
    // Validate token against public.ai_api_keys (using simple hash check for this example)
    // In production, use a more secure hashing algorithm
    const { data: keyData, error: keyError } = await supabase
      .from("ai_api_keys")
      .select("organizacao_id, id")
      .eq("key_hash", token)
      .single();

    if (keyError || !keyData) {
      return new Response(JSON.stringify({ error: "Forbidden", message: "Invalid API Key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const orgId = keyData.organizacao_id;
    const url = new URL(req.url);
    // Remove the function prefix correctly
    const path = url.pathname.split('/crm-external-api')[1] || "/";

    // Documentation endpoint
    if (path === "/" || path === "/docs") {
      return new Response(JSON.stringify(API_DOCS), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Logic for each endpoint
    const body = req.method !== "GET" ? await req.json() : null;

    let result;
    switch (path) {
      case "/email-analysis":
        // Find client by CNPJ if provided
        let clientId = null;
        if (body.client_cnpj) {
          const { data: client } = await supabase
            .from("clientes")
            .select("id")
            .eq("cnpj", body.client_cnpj)
            .eq("organizacao_id", orgId)
            .maybeSingle();
          clientId = client?.id;
        }

        const { data: analysis, error: analysisError } = await supabase
          .from("ai_email_analyses")
          .insert({
            organizacao_id: orgId,
            email_summary: body.email_summary,
            category: body.category,
            priority: body.priority,
            identified_client_id: clientId,
            suggested_action: body.suggested_action,
            urgency_score: body.urgency_score,
            received_at: body.received_at || new Date().toISOString(),
            payload: body
          })
          .select()
          .single();

        if (analysisError) throw analysisError;
        
        // Auto-create task if priority is high
        if (body.priority === 'alta') {
          await supabase.from("tarefas").insert({
            organizacao_id: orgId,
            titulo: `Follow-up: ${body.category}`,
            descricao: `IA Suggestion: ${body.suggested_action}\nSummary: ${body.email_summary}`,
            prioridade: 'alta',
            cliente_id: clientId
          });
        }
        
        result = { success: true, data: analysis };
        break;

      case "/tasks":
        const { data: task, error: taskError } = await supabase
          .from("tarefas")
          .insert({
            organizacao_id: orgId,
            titulo: body.title,
            descricao: body.description,
            prioridade: body.priority,
            vencimento: body.due_date,
            cliente_id: body.client_id,
            status: 'pendente'
          })
          .select()
          .single();
        if (taskError) throw taskError;
        result = { success: true, data: task };
        break;

      case "/clients":
        if (req.method === "GET") {
          const { data: clients } = await supabase
            .from("clientes")
            .select("*")
            .eq("organizacao_id", orgId)
            .limit(100);
          result = { success: true, data: clients };
        } else {
          const { data: newClient, error: clientErr } = await supabase
            .from("clientes")
            .insert({
              ...body,
              organizacao_id: orgId
            })
            .select()
            .single();
          if (clientErr) throw clientErr;
          result = { success: true, data: newClient };
        }
        break;

      case "/opportunities":
        if (req.method === "GET") {
          const { data: opps } = await supabase
            .from("interacoes")
            .select("*")
            .eq("organizacao_id", orgId)
            .eq("tipo", "oportunidade")
            .limit(100);
          result = { success: true, data: opps };
        } else {
          const { data: newOpp, error: oppErr } = await supabase
            .from("interacoes")
            .insert({
              organizacao_id: orgId,
              cliente_id: body.client_id,
              titulo_oportunidade: body.title,
              valor: body.value,
              etapa_pipeline: body.stage,
              probabilidade: body.probability,
              tipo: "oportunidade",
              data: new Date().toISOString()
            })
            .select()
            .single();
          if (oppErr) throw oppErr;
          result = { success: true, data: newOpp };
        }
        break;

      case "/interactions":
        const { data: interaction, error: intErr } = await supabase
          .from("interacoes")
          .insert({
            organizacao_id: orgId,
            cliente_id: body.client_id,
            tipo: body.type,
            observacao: body.notes,
            data: body.date || new Date().toISOString()
          })
          .select()
          .single();
        if (intErr) throw intErr;

        let clienteNome = null;
        if (interaction.cliente_id) {
          const { data: cli } = await supabase
            .from("clientes")
            .select("razao_social")
            .eq("id", interaction.cliente_id)
            .single();
          clienteNome = cli?.razao_social ?? null;
        }

        result = { success: true, data: { ...interaction, cliente_nome: clienteNome } };
        break;

      default:
        return new Response(JSON.stringify({ error: "Not Found", message: `Endpoint ${path} not found` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // Webhook triggering
    try {
      const { data: webhooks } = await supabase
        .from("webhooks_config")
        .select("url, secret_token")
        .eq("organizacao_id", orgId)
        .eq("active", true);

      if (webhooks && webhooks.length > 0) {
        // Run webhooks in background (don't await to keep API fast)
        Promise.all(webhooks.map(async (webhook) => {
          try {
            await fetch(webhook.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CRM-Event': `api.${path.substring(1)}`,
                'Authorization': webhook.secret_token ? `Bearer ${webhook.secret_token}` : ''
              },
              body: JSON.stringify({
                event: `api.${path.substring(1)}`,
                timestamp: new Date().toISOString(),
                org_id: orgId,
                data: result.data
              })
            });
          } catch (err) {
            console.error(`Webhook failed for ${webhook.url}:`, err);
          }
        }));
      }
    } catch (whError) {
      console.error("Webhook trigger error:", whError);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[API ERROR]", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
