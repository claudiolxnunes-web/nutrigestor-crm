import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { email, password, nome_empresa, nome_gestor } = body ?? {};

    if (!email || !password || !nome_empresa || !nome_gestor) {
      return json({ error: "email, password, nome_empresa e nome_gestor são obrigatórios" }, 400);
    }
    if (typeof password !== "string" || password.length < 6) {
      return json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    }
    if (typeof nome_empresa !== "string" || nome_empresa.trim().length < 2) {
      return json({ error: "Nome da empresa inválido" }, 400);
    }

    // 1) Cria usuário (auto-confirmado, sem e-mail de verificação)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_gestor, nome_empresa },
    });
    if (createErr) return json({ error: createErr.message }, 400);
    const userId = created.user!.id;

    // 2) Cria organização em trial (14 dias)
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 14);
    const { data: org, error: orgErr } = await admin
      .from("organizacoes")
      .insert({
        nome: nome_empresa.trim(),
        status: "ativa",
        plano: "trial",
        data_expiracao: dataExpiracao.toISOString().slice(0, 10),
        observacoes: `Trial criado via signup por ${nome_gestor} (${email})`,
      })
      .select()
      .single();
    if (orgErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      return json({ error: "Falha ao criar empresa: " + orgErr.message }, 500);
    }

    // 3) Vincula como gestor
    const { error: memErr } = await admin
      .from("organizacao_membros")
      .insert({ organizacao_id: org.id, user_id: userId, papel: "gestor" });
    if (memErr) return json({ error: "Falha ao vincular gestor: " + memErr.message }, 500);

    // 4) Atribui role gestor
    await admin.from("user_roles").insert({ user_id: userId, role: "gestor" });

    return json({
      success: true,
      organizacao_id: org.id,
      trial_expira_em: org.data_expiracao,
      message: "Empresa criada! Você já pode fazer login.",
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});