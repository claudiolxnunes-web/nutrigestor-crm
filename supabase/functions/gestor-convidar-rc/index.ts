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

    // Cliente do usuário (com JWT) — para identificar o gestor
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const gestorId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verifica se é gestor (ou super_admin)
    const { data: isGestor } = await admin.rpc("has_role", { _user_id: gestorId, _role: "gestor" });
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: gestorId });
    if (!isGestor && !isSuper) return json({ error: "Apenas gestores podem convidar RCs" }, 403);

    // Pega org do gestor
    const { data: orgId } = await admin.rpc("get_user_org", { _user_id: gestorId });
    if (!orgId) return json({ error: "Gestor sem organização vinculada" }, 400);

    // Verifica se org está ativa
    const { data: orgAtiva } = await admin.rpc("org_is_active", { _org_id: orgId });
    if (!orgAtiva) return json({ error: "Organização inativa ou expirada" }, 403);

    const body = await req.json();
    const { email, nome, cod_rc, telefone, regiao, redirect_url } = body ?? {};
    if (!email || !nome) return json({ error: "email e nome são obrigatórios" }, 400);

    const emailNorm = String(email).trim().toLowerCase();

    // Verifica se o usuário já existe no Auth
    let newUserId: string;
    const { data: existingUser } = await admin.auth.admin.listUsers();
    const userInAuth = existingUser?.users.find(u => u.email === emailNorm);

    if (userInAuth) {
      newUserId = userInAuth.id;
    } else {
      // Cria usuário (sem senha — RC define no primeiro acesso). email_confirm:true para já confirmar.
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailNorm,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);
      newUserId = created.user!.id;
    }

    // Verifica se já está vinculado à org
    const { data: existingMember } = await admin
      .from("organizacao_membros")
      .select("id")
      .eq("organizacao_id", orgId)
      .eq("user_id", newUserId)
      .maybeSingle();

    if (!existingMember) {
      // Vincula à org
      const { error: memErr } = await admin
        .from("organizacao_membros")
        .insert({ organizacao_id: orgId, user_id: newUserId, papel: "rc" });
      if (memErr) {
        // Se criamos o usuário agora e falhou o vínculo, removemos para permitir retry limpo
        if (!userInAuth) await admin.auth.admin.deleteUser(newUserId).catch(() => {});
        return json({ error: "Falha ao vincular à organização: " + memErr.message }, 500);
      }
    }

    // Garante que tenha o role de rc
    const { data: hasRepRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", newUserId)
      .eq("role", "rc")
      .maybeSingle();
    
    if (!hasRepRole) {
      await admin.from("user_roles").insert({ user_id: newUserId, role: "rc" });
    }

    // Verifica se já existe registro na tabela representantes
    const { data: existingRep } = await admin
      .from("representantes")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();

    if (existingRep) {
      // Atualiza o registro existente
      const { error: repUpdErr } = await admin
        .from("representantes")
        .update({
          auth_user_id: newUserId,
          nome: String(nome).trim(),
          cod_rc: cod_rc ? String(cod_rc).trim() : null,
          telefone: telefone ?? null,
          regiao: regiao ?? null,
          status: "ativo",
          organizacao_id: orgId, // Garante que está na org correta
        })
        .eq("id", existingRep.id);
      if (repUpdErr) return json({ error: "Falha ao atualizar representante: " + repUpdErr.message }, 500);
    } else {
      // Cria registro de representante
      const { error: repErr } = await admin.from("representantes").insert({
        organizacao_id: orgId,
        user_id: gestorId,
        auth_user_id: newUserId,
        nome: String(nome).trim(),
        cod_rc: cod_rc ? String(cod_rc).trim() : null,
        email: emailNorm,
        telefone: telefone ?? null,
        regiao: regiao ?? null,
        status: "ativo",
      });
      if (repErr) {
        return json({ error: "Usuário preparado mas falha ao registrar representante: " + repErr.message }, 500);
      }
    }

    // Gera link de primeiro acesso (recovery → permite definir senha)
    const redirectTo = redirect_url || `${new URL(req.url).origin.replace("functions", "app")}/auth`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: emailNorm,
      options: { redirectTo },
    });
    if (linkErr) {
      return json({
        success: true,
        user_id: newUserId,
        invite_link: null,
        warning: "Usuário criado, mas falha ao gerar link de acesso: " + linkErr.message,
      });
    }
    const inviteLink = linkData?.properties?.action_link ?? null;

    // Busca nome da org para o email
    const { data: orgData } = await admin.from("organizacoes").select("nome").eq("id", orgId).single();
    const orgNome = orgData?.nome ?? "sua organização";

    // Dispara email transacional (best-effort)
    let emailSent = false;
    let emailError: string | null = null;
    if (inviteLink) {
      try {
        const { error: emailErr } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "convite-rc",
            recipientEmail: emailNorm,
            idempotencyKey: `convite-rc-${newUserId}`,
            templateData: {
              nome_rc: nome,
              nome_org: orgNome,
              invite_link: inviteLink,
            },
          },
        });
        if (emailErr) {
          emailError = emailErr.message;
        } else {
          emailSent = true;
        }
      } catch (e) {
        emailError = (e as Error).message;
      }
    }

    return json({
      success: true,
      user_id: newUserId,
      invite_link: inviteLink,
      email_sent: emailSent,
      email_error: emailError,
    });
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