import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { CrudPage } from "@/components/crm/CrudPage";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Copy, Check, MessageCircle, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";

const optionalStr = (max: number) =>
  z.preprocess(
    (v) => (v == null ? "" : v),
    z.string().trim().max(max).optional().or(z.literal(""))
  );

const schema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(120),
  cod_rc: optionalStr(50),
  email: z.preprocess(
    (v) => (v == null ? "" : v),
    z.string().trim().max(255).email("E-mail inválido").or(z.literal(""))
  ),
  telefone: optionalStr(20),
  regiao: optionalStr(120),
  meta_mensal: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).optional()
  ),
  status: optionalStr(20),
});

const ConvidarRcDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [codRc, setCodRc] = useState("");
  const [telefone, setTelefone] = useState("");
  const [regiao, setRegiao] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setNome(""); setEmail(""); setCodRc(""); setTelefone(""); setRegiao("");
    setInviteLink(null); setEmailSent(false); setCopied(false);
  };

  const enviar = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/auth`;
    const { data, error } = await supabase.functions.invoke("gestor-convidar-rc", {
      body: {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        cod_rc: codRc.trim() || null,
        telefone: telefone.trim() || null,
        regiao: regiao.trim() || null,
        redirect_url: redirectUrl,
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Erro ao convidar");
      return;
    }
    setInviteLink((data as any).invite_link ?? null);
    setEmailSent(Boolean((data as any).email_sent));
    toast.success(
      (data as any).email_sent
        ? "RC criado e e-mail enviado!"
        : "RC criado. Compartilhe o link manualmente."
    );
  };

  const copiar = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsapp = () => {
    if (!inviteLink) return;
    const msg = encodeURIComponent(
      `Olá ${nome}! Você foi convidado(a) para o Agro CRM. Acesse e defina sua senha: ${inviteLink}`
    );
    const tel = telefone.replace(/\D/g, "");
    const url = tel
      ? `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" />Convidar RC</Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-md rounded-[24px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
        <DialogHeader className="p-6 md:p-8 pb-0 text-left">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-primary/5 rounded-[18px]">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">{inviteLink ? "Convite Criado" : "Convidar RC"}</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Expansão de Equipe</p>
            </div>
          </div>
        </DialogHeader>
        <div className="p-6 md:p-8 space-y-4 max-h-[70vh] overflow-y-auto">
        {!inviteLink ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              O representante receberá um e-mail para definir a senha. Você também poderá enviar o link por WhatsApp.
            </p>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome Completo *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail Corporativo *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cód. RC</Label>
                <Input value={codRc} onChange={(e) => setCodRc(e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">WhatsApp</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(DDD) 99999-9999" className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Região de Atuação</Label>
              <Input value={regiao} onChange={(e) => setRegiao(e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 p-4 bg-emerald-50/50 dark:bg-emerald-500/5 space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <Mail className="h-4 w-4" />
                </div>
                {emailSent ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider">E-mail de convite enviado!</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400 font-bold uppercase text-[10px] tracking-wider">E-mail pendente — use o link abaixo</span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Link de Primeiro Acesso</Label>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-mono text-[10px] flex-1" />
                <Button size="icon" variant="outline" onClick={copiar} className="h-12 w-12 rounded-xl border-slate-200 dark:border-white/10 shrink-0">
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={whatsapp} variant="outline" className="w-full h-14 rounded-xl border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest text-[10px] hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
              <MessageCircle className="mr-2 h-5 w-5" /> Enviar via WhatsApp
            </Button>
          </div>
        )}
        </div>
        <DialogFooter className="p-6 md:p-8 pt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02] mt-0">
          {!inviteLink ? (
            <>
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} className="rounded-xl h-14 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 order-2 sm:order-1">Cancelar</Button>
              <Button onClick={enviar} disabled={loading} className="rounded-xl h-14 px-10 font-black uppercase tracking-widest text-[10px] shadow-xl hover:shadow-primary/30 active:scale-95 order-1 sm:order-2">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Criar Representante
              </Button>
            </>
          ) : (
            <Button onClick={() => { setOpen(false); reset(); window.location.reload(); }} className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:shadow-primary/30">Concluir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Representantes = () => {
  const navigate = useNavigate();
  const { isGestor, loading: roleLoading } = useRole();

  if (!roleLoading && !isGestor) {
    navigate("/meu-painel", { replace: true });
    return null;
  }

  return (
  <>
    <PageHeader
      title="Representantes"
      subtitle="Cadastro e acompanhamento da equipe comercial"
      actions={isGestor ? <ConvidarRcDialog /> : null}
    />
    <CrudPage
      table="representantes"
      itemLabel="Representante"
      schema={schema}
      fields={[
        { name: "nome", label: "Nome", required: true },
        { name: "cod_rc", label: "Cód. RC" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "telefone", label: "Telefone" },
        { name: "regiao", label: "Região" },
        { name: "meta_mensal", label: "Meta Mensal (R$)", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "ativo", label: "Ativo" },
            { value: "inativo", label: "Inativo" },
          ],
        },
      ]}
      columns={[
        { key: "nome", label: "Nome" },
        { key: "cod_rc", label: "Cód. RC" },
        { key: "regiao", label: "Região" },
        { key: "telefone", label: "Telefone" },
        { key: "status", label: "Status" },
      ]}
    />
  </>
  );
};

export default Representantes;