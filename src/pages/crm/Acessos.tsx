import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { PageHeader } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, LogIn, LogOut, ShieldAlert } from "lucide-react";

const formatDur = (s?: number | null) => {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}min ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
};

const eventoBadge = (e: string) => {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    login: { label: "Login", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400", icon: LogIn },
    logout: { label: "Logout", cls: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300", icon: LogOut },
    blocked_attempt: { label: "Bloqueado", cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400", icon: ShieldAlert },
    heartbeat: { label: "Atividade", cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400", icon: Activity },
  };
  const m = map[e] ?? { label: e, cls: "bg-slate-100 text-slate-600", icon: Activity };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
};

export default function Acessos() {
  const navigate = useNavigate();
  const { orgId } = useOrg();
  const { isGestor, loading: roleLoading } = useRole();
  const [filtroUser, setFiltroUser] = useState<string>("all");
  const [filtroEvento, setFiltroEvento] = useState<string>("all");
  const [busca, setBusca] = useState("");

  if (!roleLoading && !isGestor) {
    navigate("/meu-painel", { replace: true });
    return null;
  }

  const { data: reps = [] } = useQuery({
    queryKey: ["reps-for-acessos", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("representantes")
        .select("id, nome, email, auth_user_id, acesso_bloqueado")
        .eq("organizacao_id", orgId!)
        .order("nome");
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["access-logs", orgId, filtroUser, filtroEvento],
    queryFn: async () => {
      let q = supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (orgId) q = q.eq("organizacao_id", orgId);
      if (filtroUser !== "all") q = q.eq("user_id", filtroUser);
      if (filtroEvento !== "all") q = q.eq("evento", filtroEvento);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const repByUser = new Map(reps.map((r: any) => [r.auth_user_id, r]));
  const visiveis = logs.filter((l: any) => {
    if (!busca.trim()) return true;
    const t = busca.toLowerCase();
    const rep = repByUser.get(l.user_id);
    return (
      (l.user_email ?? "").toLowerCase().includes(t) ||
      (rep?.nome ?? "").toLowerCase().includes(t) ||
      (l.ip ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <>
      <PageHeader title="Controle de Acessos" subtitle="Histórico de logins, logouts e tentativas bloqueadas" />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Buscar</label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail ou IP" className="h-11 rounded-xl" />
          </div>
          <div className="min-w-[220px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Representante</label>
            <Select value={filtroUser} onValueChange={setFiltroUser}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {reps.filter((r: any) => r.auth_user_id).map((r: any) => (
                  <SelectItem key={r.id} value={r.auth_user_id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Evento</label>
            <Select value={filtroEvento} onValueChange={setFiltroEvento}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="blocked_attempt">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-950 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Dispositivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-sm text-slate-400">Carregando…</TableCell></TableRow>
              ) : visiveis.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-sm text-slate-400">Nenhum acesso registrado.</TableCell></TableRow>
              ) : visiveis.map((l: any) => {
                const rep = repByUser.get(l.user_id);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-mono">
                      {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {rep?.nome ?? l.user_email ?? l.user_id.slice(0, 8)}
                      {rep?.acesso_bloqueado && <Badge variant="destructive" className="ml-2 text-[9px]">Bloqueado</Badge>}
                    </TableCell>
                    <TableCell>{eventoBadge(l.evento)}</TableCell>
                    <TableCell className="text-xs">{formatDur(l.duracao_segundos)}</TableCell>
                    <TableCell className="text-xs font-mono">{l.ip ?? "—"}</TableCell>
                    <TableCell className="text-[10px] text-slate-400 max-w-[280px] truncate" title={l.user_agent ?? ""}>{l.user_agent ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] text-slate-400">Exibindo os 500 registros mais recentes.</p>
      </div>
    </>
  );
}