import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppLayout";
import { Plus, Shield, Calendar, UserPlus, Ban, RefreshCw, Users, Mail } from "lucide-react";

type Org = {
  id: string;
  nome: string;
  status: string;
  data_expiracao: string | null;
  plano: string | null;
  observacoes: string | null;
  created_at: string;
};

type Membro = { user_id: string; email: string; papel: string; created_at: string };

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading } = useRole();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmado, setConfirmado] = useState<boolean | null>(null);
  const [membros, setMembros] = useState<Record<string, Membro[]>>({});

  // Nova org
  const [openNew, setOpenNew] = useState(false);
  const [novaNome, setNovaNome] = useState("");
  const [novoPlano, setNovoPlano] = useState("basico");
  const [novaValidade, setNovaValidade] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Novo usuário
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoPapel, setNovoPapel] = useState("gestor");
  const [novoNomeRc, setNovoNomeRc] = useState("");
  const [novoCodRc, setNovoCodRc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("organizacoes").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setOrgs((data as Org[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!orgs.length || !confirmado) return;
    (async () => {
      const map: Record<string, Membro[]> = {};
      await Promise.all(orgs.map(async (o) => {
        const { data, error } = await supabase.rpc("listar_membros_org", { _org_id: o.id });
        if (!error) map[o.id] = (data as Membro[]) ?? [];
      }));
      setMembros(map);
    })();
  }, [orgs, confirmado]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setConfirmado((data ?? []).some((r: any) => r.role === "super_admin"));
    });
  }, [user]);

  if (authLoading || roleLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (confirmado === false) return <Navigate to="/" replace />;
  if (confirmado === null) return <div className="text-muted-foreground">Verificando permissões...</div>;

  const criarOrg = async () => {
    if (!user || !novaNome.trim()) return;
    const { error } = await supabase.from("organizacoes").insert({
      nome: novaNome.trim(), plano: novoPlano,
      data_expiracao: novaValidade || null, status: "ativa",
    });
    if (error) return toast.error(error.message);
    toast.success("Organização criada");
    setOpenNew(false); setNovaNome("");
    load();
  };

  const alterarStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("organizacoes").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${status}`); load();
  };

  const estender = async (org: Org) => {
    const dias = prompt("Estender por quantos dias?", "30");
    if (!dias) return;
    const base = org.data_expiracao && org.data_expiracao > new Date().toISOString().slice(0, 10)
      ? new Date(org.data_expiracao) : new Date();
    base.setDate(base.getDate() + Number(dias));
    const nova = base.toISOString().slice(0, 10);
    const { error } = await supabase.from("organizacoes").update({ data_expiracao: nova, status: "ativa" }).eq("id", org.id);
    if (error) return toast.error(error.message);
    toast.success(`Estendido até ${nova}`); load();
  };

  const criarUsuario = async (orgId: string) => {
    if (!novoEmail || !novaSenha) return toast.error("Preencha email e senha");
    if (novoPapel === "rc" && !novoNomeRc.trim()) return toast.error("Informe o nome do RC");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-criar-usuario-org", {
      body: {
        email: novoEmail,
        password: novaSenha,
        organizacao_id: orgId,
        papel: novoPapel,
        nome: novoPapel === "rc" ? novoNomeRc : null,
        cod_rc: novoPapel === "rc" ? (novoCodRc || null) : null,
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Erro");
    toast.success("Usuário criado e vinculado");
    setOpenUser(null); setNovoEmail(""); setNovaSenha(""); setNovoNomeRc(""); setNovoCodRc("");
    // refresh membros desta org
    const { data: refreshed } = await supabase.rpc("listar_membros_org", { _org_id: orgId });
    setMembros((m) => ({ ...m, [orgId]: (refreshed as Membro[]) ?? [] }));
  };

  const statusColor = (s: string) =>
    s === "ativa" ? "default" : s === "suspensa" ? "secondary" : "destructive";

  return (
    <div>
      <PageHeader
        title="Super Admin"
        subtitle="Gestão de organizações e licenças"
        actions={
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova organização</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova organização</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={novaNome} onChange={(e) => setNovaNome(e.target.value)} /></div>
                <div><Label>Plano</Label>
                  <Select value={novoPlano} onValueChange={setNovoPlano}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Validade (deixe vazio = sem expiração)</Label>
                  <Input type="date" value={novaValidade} onChange={(e) => setNovaValidade(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                <Button onClick={criarOrg}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <p className="text-muted-foreground">Carregando organizações...</p>
      ) : orgs.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma organização ainda.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orgs.map((o) => {
            const expirada = o.data_expiracao && o.data_expiracao < new Date().toISOString().slice(0, 10);
            return (
              <Card key={o.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />{o.nome}</h3>
                    <p className="text-xs text-muted-foreground">Plano: {o.plano ?? "—"}</p>
                  </div>
                  <Badge variant={statusColor(o.status) as any}>{o.status}</Badge>
                </div>
                <div className="text-xs flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {o.data_expiracao
                    ? <>Expira em <span className={expirada ? "text-destructive font-medium" : "font-medium text-foreground"}>{o.data_expiracao}</span></>
                    : "Sem expiração"}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Usuários ({membros[o.id]?.length ?? 0})
                  </div>
                  {membros[o.id] === undefined ? (
                    <p className="text-xs text-muted-foreground">Carregando...</p>
                  ) : membros[o.id].length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum usuário vinculado.</p>
                  ) : (
                    <ul className="space-y-1">
                      {membros[o.id].map((m) => (
                        <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate" title={m.email}>{m.email}</span>
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 shrink-0">{m.papel}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Dialog open={openUser === o.id} onOpenChange={(v) => setOpenUser(v ? o.id : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><UserPlus className="mr-1 h-3.5 w-3.5" />Novo usuário</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Novo usuário em "{o.nome}"</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>E-mail</Label><Input value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} /></div>
                        <div><Label>Senha</Label><Input type="text" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} /></div>
                        <div><Label>Papel</Label>
                          <Select value={novoPapel} onValueChange={setNovoPapel}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="rc">Representante</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {novoPapel === "rc" && (
                          <>
                            <div><Label>Nome do RC</Label><Input value={novoNomeRc} onChange={(e) => setNovoNomeRc(e.target.value)} placeholder="Ex.: João Silva" /></div>
                            <div><Label>Cód. RC</Label><Input value={novoCodRc} onChange={(e) => setNovoCodRc(e.target.value)} placeholder="Ex.: 001" /></div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenUser(null)}>Cancelar</Button>
                        <Button onClick={() => criarUsuario(o.id)} disabled={creating}>{creating ? "Criando..." : "Criar"}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button size="sm" variant="outline" onClick={() => estender(o)}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />Estender
                  </Button>
                  {o.status !== "suspensa" && (
                    <Button size="sm" variant="outline" onClick={() => alterarStatus(o.id, "suspensa")}>Suspender</Button>
                  )}
                  {o.status !== "ativa" && (
                    <Button size="sm" variant="outline" onClick={() => alterarStatus(o.id, "ativa")}>Reativar</Button>
                  )}
                  {o.status !== "revogada" && (
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm("Revogar definitivamente?")) alterarStatus(o.id, "revogada");
                    }}><Ban className="mr-1 h-3.5 w-3.5" />Revogar</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}