const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  let provider: "openai" | "none" = "none";
  let model = "";
  let authStatus: "ok" | "invalid" | "no_credits" | "missing" | "error" = "missing";
  let message = "";

  if (OPENAI_API_KEY) {
    provider = "openai";
    model = "gpt-4o-mini";
    try {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      });
      if (r.ok) {
        authStatus = "ok";
        message = "Conectado à OpenAI com sua chave pessoal.";
      } else if (r.status === 401) {
        authStatus = "invalid";
        message = "Chave da OpenAI inválida ou revogada.";
      } else if (r.status === 429 || r.status === 402) {
        authStatus = "no_credits";
        message = "Conta OpenAI sem créditos disponíveis.";
      } else {
        authStatus = "error";
        message = `OpenAI retornou status ${r.status}.`;
      }
    } catch {
      authStatus = "error";
      message = "Falha ao validar a chave da OpenAI.";
    }
  } else {
    message = "OPENAI_API_KEY não configurada. Adicione nas secrets do Supabase.";
  }

  return new Response(
    JSON.stringify({ provider, model, authStatus, message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
