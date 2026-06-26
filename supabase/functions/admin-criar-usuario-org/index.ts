import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente do usuário (com JWT) — para checar se é super_admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);

    // Cliente admin
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("is_super_admin", { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: "Apenas super_admin pode criar usuários" }, 403);

    const body = await req.json();
    const { email, password, organizacao_id, papel = "gestor", nome, cod_rc } = body ?? {};
    if (!email || !password || !organizacao_id) {
      return json({ error: "email, password e organizacao_id são obrigatórios" }, 400);
    }

    // Cria o usuário (já confirmado)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return json({ error: createErr.message }, 400);

    const newUserId = created.user!.id;

    // Vincula à organização
    const { error: memErr } = await admin
      .from("organizacao_membros")
      .insert({ organizacao_id, user_id: newUserId, papel });
    if (memErr) return json({ error: "Usuário criado mas falha ao vincular: " + memErr.message }, 500);

    // Cria role
    const role = papel === "rc" ? "rc" : "gestor";
    await admin.from("user_roles").insert({ user_id: newUserId, role });

    if (papel === "rc") {
      if (!nome) return json({ error: "nome é obrigatório para criar RC" }, 400);
      const { error: repErr } = await admin
        .from("representantes")
        .insert({
          organizacao_id,
          user_id: userData.user.id,
          auth_user_id: newUserId,
          nome,
          cod_rc: cod_rc ?? null,
          email,
          status: "ativo",
        });
      if (repErr) return json({ error: "Usuário criado, mas falha ao criar representante: " + repErr.message }, 500);
    }

    return json({ success: true, user_id: newUserId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}