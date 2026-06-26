import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
  import { Eye, EyeOff, ShieldCheck, Sparkles, Globe, RefreshCw } from "lucide-react";
  import { Seo } from "@/components/Seo";
  import { motion } from "framer-motion";
import { logEvent } from "@/lib/analytics";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const signupSchema = schema.extend({
  nome_gestor: z.string().trim().min(2, "Informe seu nome").max(120),
  nome_empresa: z.string().trim().min(2, "Informe o nome da empresa").max(160),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeGestor, setNomeGestor] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  // Dispara o e-mail de boas-vindas após o gestor confirmar o e-mail e logar pela 1ª vez.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      const u = session.user;
      if (!u.email_confirmed_at) return;
      const flagKey = `welcome_sent_${u.id}`;
      if (localStorage.getItem(flagKey)) return;
      localStorage.setItem(flagKey, "1");
      try {
        const meta = (u.user_metadata ?? {}) as Record<string, any>;
        // Busca a data de expiração do trial (organização do gestor)
        let trialExpira: string | undefined;
        try {
          const { data: mem } = await supabase
            .from("organizacao_membros")
            .select("organizacao_id")
            .eq("user_id", u.id)
            .maybeSingle();
          if (mem?.organizacao_id) {
            const { data: org } = await supabase
              .from("organizacoes")
              .select("data_expiracao")
              .eq("id", mem.organizacao_id)
              .maybeSingle();
            trialExpira = org?.data_expiracao ?? undefined;
          }
        } catch { /* tolerante */ }

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome-trial",
            recipientEmail: u.email,
            idempotencyKey: `welcome-trial-${u.id}`,
            templateData: {
              nome_gestor: meta.nome_gestor ?? "",
              nome_empresa: meta.nome_empresa ?? "",
              trial_expira_em: trialExpira,
              login_url: window.location.origin + "/",
            },
          },
        });
      } catch (err) {
        console.warn("Falha ao enfileirar welcome email", err);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (mode: "signin" | "signup") => {
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({ email, password, nome_gestor: nomeGestor, nome_empresa: nomeEmpresa });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("signup-empresa", {
          body: { email, password, nome_gestor: nomeGestor, nome_empresa: nomeEmpresa },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        
        logEvent("sign_up", { method: "email", company: nomeEmpresa });
        toast.success("Empresa criada! Verifique seu e-mail para confirmar a conta. Trial de 14 dias liberado.");
        setNomeGestor("");
        setNomeEmpresa("");
      } else {
        const parsed = schema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        logEvent("login", { method: "email" });
        navigate("/");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const parsed = z.string().trim().email("E-mail inválido").max(255).safeParse(resetEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de redefinição para seu e-mail.");
      setResetOpen(false);
      setResetEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar e-mail");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const parsed = z.string().trim().email("Informe um e-mail válido").max(255).safeParse(email);
    if (!parsed.success) {
      toast.error("Digite seu e-mail no campo acima e tente novamente.");
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: parsed.data,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success("Reenviamos o e-mail de confirmação. Verifique sua caixa de entrada e o spam.");
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível reenviar o e-mail.");
    } finally {
      setResendLoading(false);
    }
  };

    return (
     <main role="main" className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-slate-950 p-4 relative overflow-hidden">
       {/* Animated Background Orbs */}
       <div aria-hidden="true" className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
       <div aria-hidden="true" className="absolute bottom-0 -right-4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
       
       <Seo title="Entrar ou criar conta" description="Acesse o Agro_RC CRM ou crie sua conta com 14 dias de trial grátis para gerir representantes, clientes e metas comerciais." path="/auth" />
       
       <motion.div 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.8, ease: "easeOut" }}
         className="w-full max-w-md relative z-10"
       >
         <div className="premium-card p-10 md:p-14 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
           
           <div className="flex flex-col items-center text-center mb-12 relative z-10">
             <motion.div 
               initial={{ scale: 0.8, rotate: -10 }}
               animate={{ scale: 1, rotate: 0 }}
               whileHover={{ scale: 1.1, rotate: 5 }}
               transition={{ type: "spring", stiffness: 260, damping: 20 }}
               className="w-20 h-20 rounded-[28px] flex items-center justify-center font-black text-3xl text-white mb-8 shadow-2xl border-4 border-white/20" 
               style={{ background: "var(--gradient-sidebar)" }}
             >
               AR
             </motion.div>
             <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tightest mb-3">Agro_RC</h1>
             <div className="flex items-center gap-3 px-5 py-2 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/5">
               <ShieldCheck className="h-4 w-4 text-emerald-500" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Enterprise Secure</span>
             </div>
           </div>
 
           <Tabs defaultValue="signin" className="w-full relative z-10">
             <TabsList className="grid w-full grid-cols-2 mb-10 bg-slate-100/50 dark:bg-white/5 p-1.5 rounded-[20px] h-16 shadow-inner-soft">
               <TabsTrigger value="signin" className="rounded-[14px] font-black text-xs uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all duration-300">Entrar</TabsTrigger>
               <TabsTrigger value="signup" className="rounded-[14px] font-black text-xs uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all duration-300">Criar Conta</TabsTrigger>
             </TabsList>
 
             {(["signin", "signup"] as const).map((mode) => (
               <TabsContent key={mode} value={mode} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                 {mode === "signup" && (
                   <div className="grid grid-cols-1 gap-5">
                     <div className="space-y-3">
                       <Label htmlFor="nome-gestor" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Seu Nome</Label>
                       <Input
                         id="nome-gestor"
                         value={nomeGestor}
                         onChange={(e) => setNomeGestor(e.target.value)}
                         placeholder="Nome completo"
                         className="h-14 rounded-[16px] bg-slate-50 dark:bg-white/5 border-transparent focus:bg-white dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-primary/10 transition-all font-semibold px-5"
                       />
                     </div>
                     <div className="space-y-3">
                       <Label htmlFor="nome-empresa" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Nome da Empresa</Label>
                       <Input
                         id="nome-empresa"
                         value={nomeEmpresa}
                         onChange={(e) => setNomeEmpresa(e.target.value)}
                         placeholder="Ex.: Distribuidora Agro"
                         className="h-14 rounded-[16px] bg-slate-50 dark:bg-white/5 border-transparent focus:bg-white dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-primary/10 transition-all font-semibold px-5"
                       />
                     </div>
                   </div>
                 )}
                 <div className="space-y-3">
                   <Label htmlFor={`email-${mode}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">E-mail Corporativo</Label>
                   <Input
                     id={`email-${mode}`}
                     type="email"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="exemplo@agro.com"
                     className="h-14 rounded-[16px] bg-slate-50 dark:bg-white/5 border-transparent focus:bg-white dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-primary/10 transition-all font-semibold px-5"
                   />
                 </div>
                 <div className="space-y-3">
                   <div className="flex items-center justify-between ml-1">
                     <Label htmlFor={`pwd-${mode}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Senha de Acesso</Label>
                     {mode === "signin" && (
                       <button
                         type="button"
                         onClick={() => { setResetEmail(email); setResetOpen(true); }}
                         className="text-[9px] font-black text-primary hover:opacity-70 transition-opacity uppercase tracking-widest"
                       >
                         Esqueceu a senha?
                       </button>
                     )}
                   </div>
                   <div className="relative">
                     <Input
                       id={`pwd-${mode}`}
                       type={showPassword ? "text" : "password"}
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       placeholder="••••••••"
                       className="h-14 rounded-[16px] bg-slate-50 dark:bg-white/5 border-transparent focus:bg-white dark:focus:bg-white/[0.08] focus:ring-4 focus:ring-primary/10 transition-all font-semibold px-5 pr-14"
                     />
                     <button
                       type="button"
                       onClick={() => setShowPassword((v) => !v)}
                       className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                       aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                     >
                       {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                     </button>
                   </div>
                 </div>
                 
                 <Button 
                   onClick={() => handleSubmit(mode)} 
                   disabled={loading} 
                   className="w-full h-16 rounded-[18px] font-black uppercase tracking-[0.1em] text-xs shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98] mt-8 group relative overflow-hidden"
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-glow opacity-0 group-hover:opacity-10 transition-opacity" />
                   {loading ? (
                     <span className="flex items-center gap-3">
                       <RefreshCw className="h-5 w-5 animate-spin" /> Validando Credenciais...
                     </span>
                   ) : mode === "signin" ? "Entrar no Sistema" : "Começar Agora"}
                 </Button>
                 
                 {mode === "signup" && (
                   <div className="flex items-center gap-3 justify-center p-4 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                     <Sparkles className="h-4 w-4 text-emerald-600" />
                     <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.1em]">
                       14 dias de trial completo • Grátis
                     </p>
                   </div>
                 )}
                 
                 {mode === "signin" && (
                   <div className="pt-8 border-t border-slate-100 dark:border-white/5 space-y-4">
                     <button
                       type="button"
                       onClick={handleResendConfirmation}
                       disabled={resendLoading}
                       className="w-full text-[10px] font-black text-slate-400 hover:text-primary transition-all uppercase tracking-widest disabled:opacity-50"
                     >
                       {resendLoading ? "Reenviando..." : "Problemas no acesso? Reenviar e-mail"}
                     </button>
                     <a
                       href={`https://wa.me/5500000000000?text=${encodeURIComponent(
                         "Olá! Não recebi o e-mail de confirmação do Agro_RC CRM. Meu e-mail de cadastro: " + (email || "(informe aqui)")
                       )}`}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2.5 w-full text-[10px] font-black text-slate-400 hover:text-emerald-600 transition-all uppercase tracking-widest"
                     >
                       <Globe className="h-3.5 w-3.5" /> Suporte VIP via WhatsApp
                     </a>
                   </div>
                 )}
               </TabsContent>
             ))}
           </Tabs>
         </div>
         
         <p className="text-center mt-8 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
           Agro_RC &copy; 2024 &bull; Todos os direitos reservados
         </p>
       </motion.div>
 
       <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="w-[90vw] sm:max-w-sm rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
           <div className="p-8 pb-0">
             <DialogHeader>
               <DialogTitle className="text-2xl font-black tracking-tight">Recuperar Senha</DialogTitle>
               <DialogDescription className="text-sm font-medium">
                 Enviaremos um link seguro para o seu e-mail para que você possa redefinir sua senha.
               </DialogDescription>
             </DialogHeader>
           </div>
           <div className="p-8 space-y-4">
             <div className="space-y-2">
               <Label htmlFor="reset-email" className="text-xs font-bold uppercase tracking-widest text-slate-500">E-mail de Cadastro</Label>
               <Input
                 id="reset-email"
                 type="email"
                 value={resetEmail}
                 onChange={(e) => setResetEmail(e.target.value)}
                 placeholder="seu@email.com"
                 className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all dark:bg-white/5 dark:focus:bg-white/10"
               />
             </div>
           </div>
           <DialogFooter className="p-8 pt-0 flex flex-col gap-2">
             <Button onClick={handleResetPassword} disabled={resetLoading} className="w-full h-12 rounded-xl font-bold shadow-lg">
               {resetLoading ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : null}
               Enviar link de acesso
             </Button>
             <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={resetLoading} className="w-full h-12 rounded-xl font-bold text-slate-500">
               Voltar
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </main>
   );
};

export default Auth;